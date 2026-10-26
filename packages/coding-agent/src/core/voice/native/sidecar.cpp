#include <algorithm>
#include <atomic>
#include <cstdint>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include "nlohmann/json.hpp"
#include "sherpa-onnx/c-api/c-api.h"

using Json = nlohmann::json;
static std::mutex output_mutex;
static void emit(const std::string &id, const std::string &type, Json body = Json::object()) {
  body["v"] = 1; body["id"] = id; body["type"] = type;
  std::lock_guard<std::mutex> guard(output_mutex);
  std::cout << body.dump() << '\n' << std::flush;
}
static const std::string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
static std::string encode(const std::vector<uint8_t> &bytes) {
  std::string result; uint32_t value = 0; int bits = -6;
  for (auto byte : bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 0) { result += alphabet[(value >> bits) & 63]; bits -= 6; } }
  if (bits > -6) result += alphabet[((value << 8) >> (bits + 8)) & 63];
  while (result.size() % 4) result += '=';
  return result;
}
static std::vector<float> decode(const std::string &text) {
  if (text.size() > 43692 || text.size() % 4) throw std::runtime_error("invalid_audio");
  std::vector<uint8_t> bytes; uint32_t value = 0; int bits = -8; bool padded = false;
  for (char ch : text) {
    if (ch == '=') { padded = true; continue; }
    auto digit = alphabet.find(ch);
    if (padded || digit == std::string::npos) throw std::runtime_error("invalid_audio");
    value = (value << 6) | static_cast<uint32_t>(digit); bits += 6;
    if (bits >= 0) { bytes.push_back((value >> bits) & 255); bits -= 8; }
  }
  if (bytes.empty() || bytes.size() > 32768 || bytes.size() % 2) throw std::runtime_error("invalid_audio");
  std::vector<float> samples; samples.reserve(bytes.size() / 2);
  for (size_t i = 0; i < bytes.size(); i += 2) samples.push_back(static_cast<int16_t>(bytes[i] | (bytes[i + 1] << 8)) / 32768.0f);
  return samples;
}

class Engine {
  const SherpaOnnxOnlineRecognizer *recognizer = nullptr;
  const SherpaOnnxOnlineStream *stream = nullptr;
  const SherpaOnnxVoiceActivityDetector *vad = nullptr;
  const SherpaOnnxOfflineTts *tts = nullptr;
  std::thread speaking;
  std::atomic<bool> cancelled{false};
  std::atomic<bool> synthesis_running{false};
  std::string speaking_id, partial;
  bool speech = false;
  Json configuration;
  void stop_synthesis() { cancelled = true; if (speaking.joinable()) speaking.join(); }
  void reset() {
    if (stream) SherpaOnnxDestroyOnlineStream(stream);
    stream = SherpaOnnxCreateOnlineStream(recognizer);
    SherpaOnnxVoiceActivityDetectorReset(vad); partial.clear(); speech = false;
  }
  void result(const std::string &id, bool final) {
    const auto *value = SherpaOnnxGetOnlineStreamResult(recognizer, stream);
    std::string text = value && value->text ? value->text : "";
    if (value) SherpaOnnxDestroyOnlineRecognizerResult(value);
    if (final || text != partial) { emit(id, "transcript", {{"text", text}, {"final", final}}); partial = text; }
  }
  void finish(const std::string &id) {
    std::vector<float> tail(4800, 0);
    SherpaOnnxOnlineStreamAcceptWaveform(stream, 16000, tail.data(), static_cast<int32_t>(tail.size()));
    SherpaOnnxOnlineStreamInputFinished(stream);
    while (SherpaOnnxIsOnlineStreamReady(recognizer, stream)) SherpaOnnxDecodeOnlineStream(recognizer, stream);
    result(id, true); emit(id, "speech", {{"active", false}}); reset();
  }
  static int32_t audio_callback(const float *samples, int32_t count, float, void *context) {
    auto *self = static_cast<Engine *>(context);
    if (self->cancelled) return 0;
    for (int32_t start = 0; start < count && !self->cancelled; start += 16384) {
      std::vector<uint8_t> pcm;
      for (int32_t i = start; i < std::min(count, start + 16384); i++) {
        int16_t sample = static_cast<int16_t>(std::clamp(samples[i], -1.0f, 0.999969f) * 32768.0f);
        pcm.push_back(sample & 255); pcm.push_back((sample >> 8) & 255);
      }
      emit(self->speaking_id, "audio", {{"samples", encode(pcm)}, {"sampleRate", SherpaOnnxOfflineTtsSampleRate(self->tts)}});
    }
    return self->cancelled ? 0 : 1;
  }
 public:
  ~Engine() {
    stop_synthesis();
    if (stream) SherpaOnnxDestroyOnlineStream(stream);
    if (recognizer) SherpaOnnxDestroyOnlineRecognizer(recognizer);
    if (vad) SherpaOnnxDestroyVoiceActivityDetector(vad);
    if (tts) SherpaOnnxDestroyOfflineTts(tts);
  }
  void configure(const Json &config) {
    if (recognizer) throw std::runtime_error("already_configured");
    configuration = config;
    auto asr = configuration.at("asr");
    std::string encoder = asr.at("encoder"), decoder = asr.at("decoder"), joiner = asr.at("joiner"), tokens = asr.at("tokens");
    SherpaOnnxOnlineRecognizerConfig rc{};
    rc.feat_config.sample_rate = 16000; rc.feat_config.feature_dim = 80;
    rc.model_config.transducer = {encoder.c_str(), decoder.c_str(), joiner.c_str()};
    rc.model_config.tokens = tokens.c_str(); rc.model_config.num_threads = 2; rc.model_config.provider = "cpu";
    rc.decoding_method = "greedy_search"; rc.max_active_paths = 4;
    recognizer = SherpaOnnxCreateOnlineRecognizer(&rc);
    if (!recognizer) throw std::runtime_error("asr_load_failed");
    std::string model = configuration.at("vad").at("model");
    SherpaOnnxVadModelConfig vc{};
    vc.silero_vad.model = model.c_str(); vc.silero_vad.threshold = 0.5f;
    vc.silero_vad.min_silence_duration = 1.2f; vc.silero_vad.min_speech_duration = 0.15f;
    vc.silero_vad.max_speech_duration = 30.0f; vc.silero_vad.window_size = 512;
    vc.sample_rate = 16000; vc.num_threads = 1; vc.provider = "cpu";
    vad = SherpaOnnxCreateVoiceActivityDetector(&vc, 60);
    if (!vad) throw std::runtime_error("vad_load_failed");
    if (configuration.contains("tts")) {
      auto values = configuration.at("tts");
      std::string model_path = values.at("model"), voices = values.at("voices"), tts_tokens = values.at("tokens"), lexicon = values.value("lexicon", "");
      SherpaOnnxOfflineTtsConfig tc{};
      tc.model.kokoro.model = model_path.c_str(); tc.model.kokoro.voices = voices.c_str();
      tc.model.kokoro.tokens = tts_tokens.c_str(); tc.model.kokoro.lexicon = lexicon.c_str();
      tc.model.kokoro.length_scale = 1; tc.model.num_threads = 2; tc.model.provider = "cpu";
      tc.max_num_sentences = 1; tc.silence_scale = 0.2f;
      tts = SherpaOnnxCreateOfflineTts(&tc);
      if (!tts) throw std::runtime_error("tts_load_failed");
    }
    reset();
  }
  bool command(const Json &input) {
    std::string id = input.at("id"), type = input.at("type");
    if (input.at("v") != 1 || id.empty() || id.size() > 128) throw std::runtime_error("protocol_invalid");
    if (type == "configure") { configure(input.at("config")); emit(id, "ready"); return true; }
    if (type == "close") { stop_synthesis(); emit(id, "completed"); return false; }
    if (!stream) throw std::runtime_error("not_configured");
    if (type == "audio") {
      auto samples = decode(input.at("samples"));
      SherpaOnnxOnlineStreamAcceptWaveform(stream, 16000, samples.data(), static_cast<int32_t>(samples.size()));
      SherpaOnnxVoiceActivityDetectorAcceptWaveform(vad, samples.data(), static_cast<int32_t>(samples.size()));
      bool active = SherpaOnnxVoiceActivityDetectorDetected(vad);
      if (active != speech) { speech = active; emit(id, "speech", {{"active", active}}); }
      while (SherpaOnnxIsOnlineStreamReady(recognizer, stream)) SherpaOnnxDecodeOnlineStream(recognizer, stream);
      result(id, false);
      if (!SherpaOnnxVoiceActivityDetectorEmpty(vad)) finish(id);
      emit(id, "completed");
    } else if (type == "end") { finish(id); emit(id, "completed"); }
    else if (type == "cancel") { if (input.at("targetId") == speaking_id) cancelled = true; emit(id, "completed"); }
    else if (type == "synthesize") {
      if (!tts) throw std::runtime_error("tts_unavailable");
      if (synthesis_running && !cancelled) throw std::runtime_error("tts_busy");
      stop_synthesis(); speaking_id = id; cancelled = false; synthesis_running = true;
      std::string text = input.at("text"); int speaker = input.value("speaker", 0);
      if (text.empty() || text.size() > 16000) { synthesis_running = false; throw std::runtime_error("invalid_text"); }
      speaking = std::thread([this, text, speaker, id] {
        SherpaOnnxGenerationConfig config{}; config.sid = speaker; config.speed = 1.0f; config.silence_scale = 0.2f;
        const auto *audio = SherpaOnnxOfflineTtsGenerateWithConfig(tts, text.c_str(), &config, audio_callback, this);
        if (!audio && !cancelled) emit(id, "error", {{"code", "tts_failed"}});
        if (audio) SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
        synthesis_running = false; emit(id, "completed");
      });
    } else throw std::runtime_error("command_invalid");
    return true;
  }
};

int main(int argc, char **argv) {
  if (argc == 2 && std::string(argv[1]) == "--version") {
    std::cout << "loop-voice/1.0.0 protocol/1 sherpa/" << SherpaOnnxGetVersionStr() << " onnxruntime/" << SherpaOnnxGetOnnxruntimeVersionStr() << '\n'; return 0;
  }
  if (argc != 1) return 2;
  Engine engine;
  while (std::cin.good()) {
    std::string line; char ch;
    while (std::cin.get(ch) && ch != '\n') {
      if (line.size() >= 1048576) return 2;
      line += ch;
    }
    if (line.empty()) break;
    std::string id = "invalid";
    try {
      const auto input = Json::parse(line); id = input.value("id", "invalid");
      if (!engine.command(input)) break;
    } catch (const std::exception &) { emit(id, "error", {{"code", "voice_engine_command_failed"}}); }
  }
  return 0;
}
