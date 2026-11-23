import "./EchoAvatar.css";

export const EchoAvatar = ({ avatar, group = false }: { avatar?: string; group?: boolean }) => (
  <span className="echo-avatar" aria-hidden="true">
    {avatar ? (
      <img src={avatar} alt="" />
    ) : group ? (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="15" cy="16" r="5" fill="currentColor" />
        <circle cx="27" cy="16" r="5" fill="currentColor" opacity=".65" />
        <path
          d="M5 31c0-6 4-9 10-9s10 3 10 9M20 31c0-5 3-8 7-8s8 3 8 8"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="5" fill="currentColor" />
        <path
          d="M4 20h5M31 20h5M20 4v5M20 31v5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )}
  </span>
);
