
document.querySelectorAll('.block img').forEach(img => {
    const block = img.closest('.block');
    if (img.complete) {
        block.classList.add('loaded');
    } else {
        img.addEventListener('load', () => block.classList.add('loaded'));
    }
});

imagesLoaded(document.body, function () {
    new Masonry(document.body, {
        itemSelector: '.block',
        columnWidth: '.block',
        percentPosition: true,
        gutter: 12,
        transitionDuration: '0.05s'
    });
    document.getElementById('loading').style.display = 'none';
    document.body.classList.add('is-loaded');
});



window.onload = function () {
    const ground = document.getElementById('background-svg');

    let maxTranslate = 0;
    let ticking = false;

    function recalculate() {
        const viewportHeight = window.innerHeight;

        // natural rendered height BEFORE transforms
        ground.style.transform = '';

        const rect = ground.getBoundingClientRect();
        const baseHeight = rect.height;

        // how much hidden area we want
        const extraParallax = viewportHeight *1.5;

        // minimum scale required
        const scale = Math.max(
            1,
            (viewportHeight + extraParallax) / baseHeight
        );

        // final movement range
        maxTranslate =
            baseHeight * scale - viewportHeight;

        ground.dataset.scale = scale;

        ground.style.transformOrigin = 'center top';
    }

    function updateParallax() {
        const scrollTop =
            window.pageYOffset ||
            document.documentElement.scrollTop ||
            0;

        const maxScroll =
            document.documentElement.scrollHeight -
            window.innerHeight;

        const progress =
            maxScroll > 0
                ? scrollTop / maxScroll
                : 0;

        const translateY = progress * maxTranslate;

        const scale = ground.dataset.scale || 1;

        ground.style.transform =
            `translate3d(0, -${translateY}px, 0) scale(${scale})`;

        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick, {
        passive: true
    });

    window.addEventListener('resize', () => {
        recalculate();
        requestTick();
    });

    recalculate();
    updateParallax();
};

// window.addEventListener('load', () => {
//     const el = document.getElementById('background-svg');
//     el.style.willChange = 'transform';
//     el.style.transformOrigin = 'top center';

//     let containerHeight, imageTravel, currentOffset = 0, targetOffset = 0;

//     function recalculate() {
//         const isPortrait = window.innerHeight > window.innerWidth;
//         containerHeight = window.innerHeight;

//         if (isPortrait) {
//             el.style.transform = ''; // reset to measure natural size
//             const naturalHeight = el.getBoundingClientRect().height;
//             // scale up so there's room to scroll
//             const scale = (containerHeight * 2) / naturalHeight;
//             el.dataset.scale = scale; // store for use in animate()
//             imageTravel = containerHeight * 2 - containerHeight; // = 0.5 * containerHeight
//         } else {
//             el.dataset.scale = 1;
//             imageTravel = el.getBoundingClientRect().height - containerHeight;
//         }
//     }

//     window.addEventListener('resize', recalculate);
//     recalculate();

//     window.addEventListener('scroll', () => {
//         const scrolled = window.scrollY;
//         const maxScroll = document.body.scrollHeight - window.innerHeight;
//         if (maxScroll > 0) {
//             targetOffset = (scrolled / maxScroll) * imageTravel;
//         }
//     });

//     function animate() {
//         currentOffset += (targetOffset - currentOffset) * 0.1;
//         const scale = el.dataset.scale || 1;
//         el.style.transform = `scale(${scale}) translateY(-${currentOffset / scale}px)`;
//         requestAnimationFrame(animate);
//     }

//     animate();
// });
