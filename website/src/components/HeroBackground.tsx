import heroBackgroundStyles from "./HeroBackground.module.css";

export const HeroBackground = () => {
  return (
    <div className={heroBackgroundStyles["hero-background"]} aria-hidden="true">
      <span
        className={[
          heroBackgroundStyles["hero-cloud"],
          heroBackgroundStyles["hero-cloud-blue"],
        ].join(" ")}
      ></span>
      <span
        className={[
          heroBackgroundStyles["hero-cloud"],
          heroBackgroundStyles["hero-cloud-violet"],
        ].join(" ")}
      ></span>
      <span
        className={[
          heroBackgroundStyles["hero-cloud"],
          heroBackgroundStyles["hero-cloud-sky"],
        ].join(" ")}
      ></span>
      <span
        className={[
          heroBackgroundStyles["hero-cloud"],
          heroBackgroundStyles["hero-cloud-texture"],
        ].join(" ")}
      ></span>
    </div>
  );
};
