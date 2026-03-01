document.addEventListener('DOMContentLoaded', () => {

    // ===============================
    // CAMPOS FIJOS
    // ===============================
    const TEXT_FIELD = "NOME";     // Nombre del municipio / parroquia
    const VALUE_FIELD = "TAXA";    // Valor numérico a analizar

    // ===============================
    // MAPA BASE
    // ===============================
    const dark = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '&copy; CARTO' }
    );

    const map = L.map('map', {
        center: [41.5388, -8.6151],
        zoom: 11,
        layers: [dark]
    });

    // ===============================
    // VARIABLES
    // ===============================
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    const btnExportar = document.getElementById('btnExportarCSV');

    let geojsonData;
    let geojsonLayer;
    let currentBreaks = [];
    let currentPalette = [];
    let legend;

    const palettes = {
        fire:   ['#fff5cc','#ffb84d','#ff8c1a','#e65c00','#993d00'],
        azure:  ['#ffffff','#cdd3ec','#7f8dc6','#555fa3','#2a3180'],
        blue:   ['#e0f3f8','#abd9e9','#74add1','#4575b4','#313695'],
        green:  ['#e5f5e0','#a1d99b','#74c476','#31a354','#006d2c'],
        red:    ['#fee0d2','#fc9272','#fb6a4a','#de2d26','#a50f15'],
        purple: ['#f2e5ff','#d1b3ff','#b380ff','#944dff','#6600cc']
    };

    // ===============================
    // FUNCIONES ESTADÍSTICAS
    // ===============================
    function parseValue(val) {
        if (val === null || val === undefined) return NaN;
        return parseFloat(val);
    }

    function jenksBreaks(data, n) {
        data.sort((a, b) => a - b);
        const breaks = [data[0]];
        const step = Math.floor(data.length / n);
        for (let i = 1; i < n; i++) breaks.push(data[i * step]);
        breaks.push(data[data.length - 1]);
        return breaks;
    }

    function computeBreaks(method) {
        const values = geojsonData.features
            .map(f => parseValue(f.properties[VALUE_FIELD]))
            .filter(v => !isNaN(v))
            .sort((a, b) => a - b);

        const k = 5;

        if (method === 'equal') {
            const min = values[0], max = values[values.length-1];
            const step = (max-min)/k;
            return Array.from({length:k+1}, (_,i)=>min+i*step);
        }

        if (method === 'quantile') {
            return Array.from({length:k+1}, (_,i)=>values[Math.floor(i*(values.length-1)/k)]);
        }

        return jenksBreaks(values,k);
    }

    function getColor(v) {
        if (isNaN(v)) return "#333";
        for (let i = 0; i < currentBreaks.length-1; i++) {
            if (v >= currentBreaks[i] && v < currentBreaks[i+1]) return currentPalette[i];
        }
        return currentPalette[currentPalette.length-1];
    }

    function styleFeature(feature) {
        const v = parseValue(feature.properties[VALUE_FIELD]);
        return { fillColor: getColor(v), weight:1, color:"#fff", fillOpacity:0.8 };
    }

    // ===============================
    // LEYENDA
    // ===============================
    function addLegend() {
        if (legend) map.removeControl(legend);
        legend = L.control({ position:"bottomright" });

        legend.onAdd = () => {
            const div = L.DomUtil.create("div","legend");
            currentPalette.forEach((c,i)=>{
                const item = document.createElement("div");
                item.className="range-item";
                item.style.background=c;
                item.innerText = currentBreaks[i].toFixed(0) + " - " + currentBreaks[i+1].toFixed(0);
                div.appendChild(item);
            });
            return div;
        };

        legend.addTo(map);
    }

    function updateMap() {
        currentPalette = palettes[paletteSelect.value];
        currentBreaks = computeBreaks(classificationSelect.value);
        geojsonLayer.setStyle(styleFeature);
        addLegend();
    }

    // ===============================
    // CARGAR GEOJSON
    // ===============================
    fetch("barcelos.geojson")
        .then(res=>res.json())
        .then(data=>{
            geojsonData = data;
            geojsonLayer = L.geoJSON(data, {
                style: styleFeature,
                onEachFeature: (feature, layer)=>{
                    layer.bindTooltip(`
                        <strong>${feature.properties[TEXT_FIELD]}</strong><br>
                        ${VALUE_FIELD}: ${feature.properties[VALUE_FIELD]}
                    `,{sticky:true});
                }
            }).addTo(map);
            map.fitBounds(geojsonLayer.getBounds());
            updateMap();
        });

    classificationSelect.onchange = updateMap;
    paletteSelect.onchange = updateMap;

    // ===============================
    // EXPORTAR CSV
    // ===============================
    btnExportar.onclick = ()=>{
        if(!geojsonData) return;
        const headers = Object.keys(geojsonData.features[0].properties).join(",");
        const rows = geojsonData.features.map(f=>Object.values(f.properties).join(","));
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href",encodedUri);
        link.setAttribute("download","indicadores_barcelos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

});
