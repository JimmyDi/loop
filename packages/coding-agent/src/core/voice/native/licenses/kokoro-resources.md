# Kokoro resource provenance

The packaged Kokoro resources are selected from
[csukuangfj/kokoro-int8-multi-lang-v1_1](https://huggingface.co/csukuangfj/kokoro-int8-multi-lang-v1_1/tree/155831f1b4ba23b1f5c058be6a61df90cefb2a37).
The model repository's Apache-2.0 license is retained in `kokoro.txt`.

## Voices

`voices.bin` contains style tensors exported from
[hexgrad/Kokoro-82M-v1.1-zh](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh),
whose model card declares Apache-2.0. The sherpa-onnx
[voice export script](https://github.com/k2-fsa/sherpa-onnx/blob/8abb7c8f87eae85b2e75f9a4115236c978980add/scripts/kokoro/v1.1-zh/generate_voices_bin.py)
loads the upstream voice tensors and concatenates them. The upstream model card
acknowledges the Chinese training data granted by LongMaoData and the three
English voices Maple, Sol, and Vale. No separate voice license or NOTICE file was
identified in the upstream model repository.

## English lexicon

`lexicon-us-en.txt` is generated from Misaki's `us_gold.json` and
`us_silver.json`, with additional entries in the sherpa-onnx export script.
Misaki is Apache-2.0; its license is retained in `misaki.txt`. The export script
is covered by sherpa-onnx's Apache-2.0 license retained in `sherpa-onnx.txt`.

The fixed sherpa-onnx
[export commands](https://github.com/k2-fsa/sherpa-onnx/blob/8abb7c8f87eae85b2e75f9a4115236c978980add/scripts/kokoro/v1.1-zh/run.sh)
download the Misaki dictionaries from its moving `main` branch. They do not
record the exact Misaki revision used for this pre-exported model.

## Chinese lexicon

The sherpa-onnx
[Chinese lexicon export script](https://github.com/k2-fsa/sherpa-onnx/blob/8abb7c8f87eae85b2e75f9a4115236c978980add/scripts/kokoro/v1.1-zh/generate_lexicon_zh.py)
uses Misaki's phoneme conversion and enumerates python-pinyin's default
single-character and phrase dictionaries. python-pinyin states that those
dictionaries use pinyin-data and phrase-pinyin-data. All three repositories
publish MIT licenses; their notices are retained in `python-pinyin.txt`,
`pinyin-data.txt`, and `phrase-pinyin-data.txt`.

The export commands do not pin or record the installed Misaki or python-pinyin
versions. The exact historical dictionary revisions and their complete data
lineage cannot be established from the exported archive and scripts alone.
pinyin-data and phrase-pinyin-data offer several source datasets; references to
additional datasets in their current READMEs do not establish that every such
dataset was used in this exported default dictionary. The license copies below
are verified snapshots, not a claim that those exact revisions produced the
model archive.

## Retained license snapshots

| File | Fixed public source | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `misaki.txt` | [Misaki license](https://raw.githubusercontent.com/hexgrad/misaki/fba1236595f2d2bf21d414ba6e57d25256afada3/LICENSE) | 11357 | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |
| `python-pinyin.txt` | [python-pinyin license](https://raw.githubusercontent.com/mozillazg/python-pinyin/af3cc771ac768d366eddd838d7d5f6f2835142b8/LICENSE.txt) | 1105 | `1e6c90014b4912815c296ee64bb6f6280af47e6d4c5d80e86232dfc5defe764c` |
| `pinyin-data.txt` | [pinyin-data license](https://raw.githubusercontent.com/mozillazg/pinyin-data/9d05c9e29cb6a7e5c79f2f5279f5c1014246a19a/LICENSE) | 1076 | `9c048697be2502a16e8bcb282d5d465a07295b2def0ffb05a269c5d39dbe1586` |
| `phrase-pinyin-data.txt` | [phrase-pinyin-data license](https://raw.githubusercontent.com/mozillazg/phrase-pinyin-data/195893902791321fe38ae7b4ebdd9905389cfd41/LICENSE) | 1066 | `89ac55df747e4776088c3e77531ef61b973a1a59dd8e6a4548a58996da9a4f70` |

Original copyright and attribution text is preserved in these license files.
