export type Exercise = {
  id: string;
  title: string;
  prompt: string;
};

export const EXERCISES: Exercise[] = [
  {
    id: "ex-reading-1",
    title: "Easy onset reading",
    prompt:
      "Read this sentence slowly, using a gentle start on each word: The morning light moved across the quiet lake.",
  },
  {
    id: "ex-intro-1",
    title: "Short introduction",
    prompt: "Say your name and one thing you did today. Pause between sentences.",
  },
];
