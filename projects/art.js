
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

window.addEventListener('load', () => {
    const el = document.getElementById('background-svg');
    el.style.willChange = 'transform';
    el.style.transformOrigin = 'top center';

    let containerHeight, imageTravel, currentOffset = 0, targetOffset = 0;

    function recalculate() {
        const isPortrait = window.innerHeight > window.innerWidth;
        containerHeight = window.innerHeight;

        if (isPortrait) {
            el.style.transform = ''; // reset to measure natural size
            const naturalHeight = el.getBoundingClientRect().height;
            // scale up so there's room to scroll
            const scale = (containerHeight * 2) / naturalHeight;
            el.dataset.scale = scale; // store for use in animate()
            imageTravel = containerHeight * 2 - containerHeight; // = 0.5 * containerHeight
        } else {
            el.dataset.scale = 1;
            imageTravel = el.getBoundingClientRect().height - containerHeight;
        }
    }

    window.addEventListener('resize', recalculate);
    recalculate();

    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;
        const maxScroll = document.body.scrollHeight - window.innerHeight;
        if (maxScroll > 0) {
            targetOffset = (scrolled / maxScroll) * imageTravel;
        }
    });

    function animate() {
        currentOffset += (targetOffset - currentOffset) * 0.1;
        const scale = el.dataset.scale || 1;
        el.style.transform = `scale(${scale}) translateY(-${currentOffset / scale}px)`;
        requestAnimationFrame(animate);
    }

    animate();
});
