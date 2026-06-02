// Asset + stylesheet module declarations so strict TS accepts non-code imports
// (Metro resolves these at runtime; TS only needs a module shape here).
declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

declare module '*.gif' {
  const value: number;
  export default value;
}

declare module '*.webp' {
  const value: number;
  export default value;
}

declare module '*.svg' {
  const value: number;
  export default value;
}

declare module '*.css';
