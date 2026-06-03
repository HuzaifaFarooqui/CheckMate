document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const sunIcon = document.getElementById("theme-icon-sun");
    const moonIcon = document.getElementById("theme-icon-moon");

    function updateIcons(isLight) {
        if (!sunIcon || !moonIcon) return;
        if (isLight) {
            sunIcon.style.display = "none";
            moonIcon.style.display = "block";
        } else {
            sunIcon.style.display = "block";
            moonIcon.style.display = "none";
        }
    }

    // Set initial icon based on body class
    const initialIsLight = document.body.classList.contains("light-theme");
    updateIcons(initialIsLight);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            const isCurrentlyLight = document.body.classList.contains("light-theme");
            if (isCurrentlyLight) {
                document.body.classList.remove("light-theme");
                document.body.classList.add("dark-theme");
                localStorage.setItem("theme", "dark");
                updateIcons(false);
            } else {
                document.body.classList.remove("dark-theme");
                document.body.classList.add("light-theme");
                localStorage.setItem("theme", "light");
                updateIcons(true);
            }
        });
    }
});
