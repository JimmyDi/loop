import "./ProjectSourceIcon.css";

const paths = {
  folder:
    "M3 10h18M3 18V6a3 3 0 0 1 3-3h3a3 3 0 0 1 2.4 1.2l.6.8h6a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z",
  add: "M12 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v3M18 15v6m-3-3h6",
  computer: "M5 17V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12M3 17h18v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z",
  remove: "m6 6 12 12M18 6 6 18",
};

export const ProjectSourceIcon = ({ kind }: { kind: keyof typeof paths }) => (
  <svg className="project-source-icon" data-kind={kind} viewBox="0 0 24 24" aria-hidden="true">
    <path d={paths[kind]} />
  </svg>
);
