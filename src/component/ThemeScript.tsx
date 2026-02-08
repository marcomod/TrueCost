export default function ThemeScript() {
  const code = `(function () {
  try {
    var key = "tc_theme";
    var mode = localStorage.getItem(key) || "light";
    var root = document.documentElement;
    root.classList.toggle("dark", mode === "dark");
  } catch (e) {}
})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
