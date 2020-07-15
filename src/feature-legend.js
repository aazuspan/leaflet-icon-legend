L.Control.FeatureLegend = L.Control.extend({
    options: {
        position: 'topleft',
        title: 'Legend',
        maxSymbolSize: 18,
        minSymbolSize: 1,
        collapsed: false,
        drawShadows: false,
    },

    initialize: function (items, options) {
        this.items = items;
        L.Util.setOptions(this, options);

        this._symbols = [];
        this._buildContainer();
    },

    _initLayout: function () {
        L.DomEvent.disableClickPropagation(this._container);
        L.DomEvent.disableScrollPropagation(this._container);

        if (this.options.collapsed) {
            this._map.on('click', this.collapse, this);

            L.DomEvent.on(this._container, {
                mouseenter: this.expand,
                mouseleave: this.collapse
            }, this);
        }
        else {
            this.expand();
        }
    },

    // Repurposed from Leaflet/Canvas.js to draw paths at a fixed location in the legend
    _drawCircle: function (layer, workingCanvas) {
        const ctx = workingCanvas.getContext('2d');
        let options = layer.options;

        let radiusOffset = 0;

        if (options.stroke && options.weight !== 0) {
            radiusOffset = options.weight;
        }

        let r = Math.max(Math.min(Math.round(layer._radius), (this.options.maxSymbolSize - radiusOffset) / 2), this.options.minSymbolSize);
        let x = this.options.maxSymbolSize / 2;

        ctx.beginPath();
        ctx.arc(x, x, r, 0, Math.PI * 2, false);

        if (options.fill) {
            ctx.globalAlpha = options.fillOpacity;
            ctx.fillStyle = options.fillColor || options.color;
            ctx.fill(options.fillRule || 'evenodd');
        }

        if (options.stroke && options.weight !== 0) {
            if (ctx.setLineDash) {
                ctx.setLineDash(layer.options && layer.options._dashArray || []);
            }
            ctx.globalAlpha = options.opacity;
            ctx.lineWidth = options.weight;
            ctx.strokeStyle = options.color;
            ctx.lineCap = options.lineCap;
            ctx.lineJoin = options.lineJoin;
            ctx.stroke();
        }
    },

    _buildContainer: function () {
        this._container = L.DomUtil.create('div', 'leaflet-control-feature-legend leaflet-bar leaflet-control');

        this._contents = L.DomUtil.create('section', 'leaflet-control-feature-legend-contents', this._container)
        this._link = L.DomUtil.create('a', 'leaflet-control-feature-legend-toggle leaflet-control-layers', this._container);
        this._link.title = "Legend";
        this._link.href = "#";

        this._buildTitle();
        this._buildItems();
    },

    _buildTitle: function () {
        if (this.options.title) {
            let title = L.DomUtil.create('h3', 'leaflet-control-feature-legend-title', this._contents);
            title.innerText = this.options.title;
        }
    },

    _buildItems: function () {
        for (let item in this.items) {
            let itemLayer = this.items[item];

            if (!this._layerIsSupported(itemLayer)) {
                throw new Error(`Error: "${item}" is not a supported layer. Use only L.Marker, L.CircleMarker, or L.Circle.`);
            }

            let itemDiv = L.DomUtil.create('div', null, this._contents);
            let itemSymbol = L.DomUtil.create('i', null, itemDiv);

            itemSymbol.style.width = itemSymbol.style.height = this.options.maxSymbolSize.toString() + "px";

            if (itemLayer.options.icon) {
                this._buildImageSymbol(itemSymbol, itemLayer);
            }
            else {
                this._buildMarkerSymbol(itemSymbol, itemLayer);
            }

            let itemTitle = L.DomUtil.create('span', null, itemDiv);
            itemTitle.innerText = item;
        }
    },

    // Build the legend symbol for a marker with an image icon (such as L.Marker)
    _buildImageSymbol: function (container, layer) {
        this._symbols.push(new ImageSymbol(layer, container, this));
    },

    // Build the legend symbol for a marker without an image icon (such as L.CircleMarker)
    _buildMarkerSymbol: function (container, layer) {
        let itemCanvas = L.DomUtil.create('canvas', null, container);
        itemCanvas.height = this.options.maxSymbolSize;
        itemCanvas.width = this.options.maxSymbolSize;
        this._drawCircle(layer, itemCanvas);
    },

    // Check if a given layer belongs to a class that can be added to the legend
    _layerIsSupported: function (layer) {
        if (layer instanceof L.CircleMarker || layer instanceof L.Circle || layer instanceof L.Marker) {
            return true;
        }
        return false;
    },

    onAdd: function (map) {
        this._map = map;
        this._initLayout();
        return this._container;
    },

    expand: function () {
        this._link.style.display = "none";
        L.DomUtil.addClass(this._container, 'leaflet-control-feature-legend-expanded');

        for (symbol of this._symbols) {
            symbol.update();
        }

        return this;
    },

    collapse: function () {
        this._link.style.display = "block";
        L.DomUtil.removeClass(this._container, 'leaflet-control-feature-legend-expanded');
        return this;
    },
})


L.control.featureLegend = function (items, options) {
    return new L.Control.FeatureLegend(items, options);
};


class ImageSymbol {
    constructor(layer, container, legend) {
        this._layer = layer;
        this._container = container;
        this._legend = legend;
        this._scaleFactor = 1;

        this._initialize();
    }

    _initialize = () => {
        this.icon = this._layer.getIcon();

        this.img = this._buildImg();

        if (this._legend.options.drawShadows && this._hasShadow()) {
            this.shadow = this._buildShadow();
        }
    }

    // Build the img element for the symbol image and add it to the legend
    _buildImg = () => {
        let img = L.DomUtil.create('img', null, this._container);
        img.onload = () => { this._rescale(img); this._recenter(img) };
        img.src = this.icon instanceof L.Icon.Default ? L.Icon.Default.imagePath + "marker-icon.png" : this.icon.options.iconUrl;
        img.style.zIndex = 1;

        return img;
    }

    // Build the img element for the symbol shadow and add it to the legend
    _buildShadow = () => {
        let img = L.DomUtil.create('img', null, this._container);
        img.onload = () => { this._rescale(img); this._recenter(img) };
        img.src = this.icon instanceof L.Icon.Default ? L.Icon.Default.imagePath + "marker-shadow.png" : this.icon.options.shadowUrl;
        img.style.zIndex = 0;

        return img;
    }

    // Check if the Symbol has a defined shadow image
    _hasShadow = () => {
        return Boolean(this.icon.options.shadowUrl)
    }

    // Scale the symbol image to fit within the minimum and maximum dimensions
    _rescale = (img) => {
        let maxDimension = Math.max(img.width, img.height);
        let minDimension = Math.min(img.width, img.height);

        if (maxDimension > this._legend.options.maxSymbolSize) {
            this._scaleFactor = this._legend.options.maxSymbolSize / maxDimension;

            if (img.width === maxDimension) {
                img.width = this._legend.options.maxSymbolSize;
            }
            else {
                img.height = this._legend.options.maxSymbolSize;
            }
        }
        else if (minDimension < this._legend.options.minSymbolSize) {
            this._scaleFactor = this._legend.options.minSymbolSize / minDimension;

            if (img.width === minDimension) {
                img.width = this._legend.options.minSymbolSize;
            }
            else {
                img.height = this._legend.options.minSymbolSize;
            }
        }
    }

    // Center the symbol image in its container
    _recenter = (img) => {
        let containerCenterX = img.parentElement.offsetWidth / 2;
        let containerCenterY = img.parentElement.offsetHeight / 2;

        let imageCenterX;
        let imageCenterY;

        if (this.icon.options.iconAnchor) {
            imageCenterX = this.icon.options.iconAnchor[0] * this._scaleFactor;
            imageCenterY = this.icon.options.iconAnchor[1] / 2 * this._scaleFactor;
        }
        else {
            imageCenterX = parseInt(img.width) / 2;
            imageCenterY = parseInt(img.height) / 2;
        }

        let shiftX = containerCenterX - imageCenterX;
        let shiftY = containerCenterY - imageCenterY;

        img.style.left = shiftX.toString() + "px";
        img.style.top = shiftY.toString() + "px";
    }

    update = () => {
        if (this.shadow) {
            this._recenter(this.shadow);
        }

        this._recenter(this.img);
    }
}