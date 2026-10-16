import { asset } from "../assets";
import styles from "./BrandArtwork.module.css";

export const BrandArtwork = ({ size }: { size: number }) => (
  <picture className={styles.artwork}>
    <source media="(prefers-color-scheme: dark)" srcSet={asset("brand/loop-mark-white.svg")} />
    <img src={asset("brand/loop-mark-dark.svg")} alt="" width={size} height={size} />
  </picture>
);
