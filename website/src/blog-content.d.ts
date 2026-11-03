declare module "virtual:blog-content" {
  const posts: import("./blog/types").BlogPost[];
  export default posts;
}

declare module "virtual:blog-index" {
  const posts: import("./blog/types").BlogIndexPost[];
  export default posts;
}
