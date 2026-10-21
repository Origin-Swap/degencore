import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Cek apakah user sudah pernah memilih tema sebelumnya
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("qurve-theme");
      if (saved) return saved;
    }
    // Jika belum pernah, jadikan "dark" sebagai default utama
    return "dark";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    // Simpan pilihan user agar tidak berubah saat halaman di-refresh
    localStorage.setItem("qurve-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme };
}
