; (() => {
    // the extension previews / switches the cat by setting the status bar item aria-label to `${LABEL_PREFIX}${name}`
    const LABEL_PREFIX = 'Nyan Cat: ';

    const config = window.NyanCatConfiguration;

    // an img (not a span background) so the width follows the gif aspect ratio
    const nyan = document.createElement("img");
    nyan.alt = '';
    nyan.draggable = false;
    nyan.style.backgroundColor = config.backgroundColor;

    let currentName;
    let cssInjected = false;

    showCat(config.name);

    // the workbench may re-render the status bar item, so keep the cat attached instead of injecting once
    setInterval(() => {
        const container = document.getElementById(config.statusItemId);
        const statusItem = container && container.querySelector('a.statusbar-item-label');

        if (!statusItem) return;

        const label = statusItem.getAttribute('aria-label') || '';
        if (label.startsWith(LABEL_PREFIX)) showCat(label.slice(LABEL_PREFIX.length));

        if (statusItem.contains(nyan)) return;

        if (!cssInjected) {
            injectCSS();
            cssInjected = true;
        }
        statusItem.appendChild(nyan);
    }, 150);

    function showCat(requested) {
        if (requested === currentName) return;
        const isFirst = currentName === undefined;
        currentName = requested;

        let name = requested;
        if (name === 'random') name = config.names[Math.floor(Math.random() * config.names.length)];
        if (!config.names.includes(name)) name = 'bday';

        const src = `${config.imageBaseUrl}/${name}.gif?v=${config.imageVersion}`;
        const apply = () => {
            nyan.className = `nyan-cat nyan-cat-${name}`;
            nyan.src = src;
        };
        if (isFirst) return apply();

        // swap once loaded, so the status bar doesn't collapse to an empty image while previewing
        const loader = new Image();
        loader.onload = () => currentName === requested && apply();
        loader.src = src;
    }

    function injectCSS() {
        const style = document.createElement('STYLE');
        style.textContent = `
            .nyan-cat{
                height: 100%;
                width: max-content;
            }
        `;
        document.body.appendChild(style);
    }
})();
