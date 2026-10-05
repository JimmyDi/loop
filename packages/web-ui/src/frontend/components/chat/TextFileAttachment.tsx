import type { PromptFile } from "../../../shared/prompt-files";
import "./TextFileAttachment.css";

export const TextFileAttachment = ({
  file,
  variant = "preview",
}: {
  file: PromptFile;
  variant?: "preview" | "pill";
}) => {
  const extensionStart = file.name.lastIndexOf(".");
  const name = extensionStart > 0 ? file.name.slice(0, extensionStart) : file.name;
  const extension = extensionStart > 0 ? file.name.slice(extensionStart) : "";

  return (
    <details className={"text-file-attachment text-file-attachment-" + variant}>
      <summary title={file.name} aria-label={file.name}>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M14 3H5v18h14V8l-5-5Z M14 3v5h5 M8 12h8 M8 16h6" />
        </svg>
        <span className="text-file-name">
          <span className="text-file-stem">{name}</span>
          <span className="text-file-extension">{extension}</span>
        </span>
      </summary>
      <pre>{file.text}</pre>
    </details>
  );
};
