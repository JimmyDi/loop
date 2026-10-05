import "./ToolActionIcon.css";

const paths = {
  read: "M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z",
  write: "M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 14h8m-4-4v8",
  edit: "m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z",
  bash: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5 3 3-3 3m6 1h4",
  other: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
};

export const ToolActionIcon = ({ action }: { action: keyof typeof paths }) => (
  <svg className="tool-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d={paths[action]} />
  </svg>
);
