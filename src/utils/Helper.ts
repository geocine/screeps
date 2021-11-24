type Escapes = { [key: string]: string };
type EscapeType = keyof Escapes;

const htmlEscapes: Escapes = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

const reUnescapedHtml = /[&<>"']/g;
const reHasUnescapedHtml = RegExp(reUnescapedHtml.source);

export const escape = (string?: string) => {
  return string && reHasUnescapedHtml.test(string)
    ? string.replace(reUnescapedHtml, (chr: EscapeType) => htmlEscapes[chr])
    : string || "";
};
