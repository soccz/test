// main.js - Common Logic for Layout & Navigation

document.addEventListener('DOMContentLoaded', function () {
    // --------------------------------------------------------
    // 1. Progress Bar
    // --------------------------------------------------------
    const progressBar = document.getElementById('progressBar');

    if (progressBar) {
        window.addEventListener('scroll', function () {
            const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (height > 0) ? (winScroll / height) * 100 : 0;
            progressBar.style.width = scrolled + '%';
        });
    }

    // --------------------------------------------------------
    // 2. Active Navigation Highlighting
    // --------------------------------------------------------
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('nav a');

    // Only run if we actually have sections and nav links
    if (sections.length > 0 && navLinks.length > 0) {
        window.addEventListener('scroll', function () {
            let currentId = '';

            // Find which section is currently in view
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                // Offset of 150px provides better feel when scrolling
                if (window.scrollY >= sectionTop - 150) {
                    currentId = section.getAttribute('id');
                }
            });

            // Highlight matching link
            navLinks.forEach(link => {
                link.classList.remove('active');
                const href = link.getAttribute('href');

                // Handle both "#section" and "page.html#section" formats
                if (href === '#' + currentId || href.endsWith('#' + currentId)) {
                    link.classList.add('active');
                }
            });
        });
    }

    // --------------------------------------------------------
    // 3. Smooth Scroll
    // --------------------------------------------------------
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');

            // Only intercept hash links on the same page
            if (href.startsWith('#')) {
                e.preventDefault();
                const targetSection = document.querySelector(href);

                if (targetSection) {
                    // Account for fixed header height
                    const headerOffset = 70;
                    const elementPosition = targetSection.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    console.log('Main JS Loaded - Navigation & UI configured.');
});
