document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURACIÓN DE MAPAS BASE ---
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri &mdash; DigitalGlobe'
    });

    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    });

    const map = L.map('map', {
        center: [41.5388, -8.6151],
        zoom: 12,
        layers: [dark] 
    });

    const baseMaps = {
        "Modo Escuro": dark,
        "Satélite": satellite,
        "OpenStreetMap": osm
    };
    L.control.layers(baseMaps).addTo(map);

    // --- 2. GLOBALES Y REFERENCIAS DOM ---
    const btnCargar = document.getElementById('btnCargarGeoJSON');
    const btnExportar = document.getElementById('btnExportarCSV');
    const idSelect = document.getElementById('idSelect');
    const variableSelect = document.getElementById('variableSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');

    let geojsonData, geojsonLayer, legend;
    let currentBreaks = [], currentPalette = [];

    const palettes = {
        fire:   ['#fff5cc','#ffb84d','#ff8c1a','#e65c00','#993d00'],
        azure:  ['#ffffff','#cdd3ec','#7f8dc6','#555fa3','#2a3180'],
        green:  ['#e5f5e0','#a1d99b','#74c476','#31a354','#006d2c'],
        red:    ['#fee0d2','#fc9272','#fb6a4a','#de2d26','#a50f15'],
        blue:   ['#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']
    };

    // --- 3. LÓGICA ESTADÍSTICA (JENKS) ---
    function parseValue(val) {
        if (val === null || val === undefined) return NaN;
        const clean = val.toString().replace(/\./g, '').replace(',', '.').trim();
        return parseFloat(clean);
    }

    function jenksBreaks(data, n) {
        data.sort((a, b) => a - b);
        const lower = Array(data.length + 1).fill(0).map(() => Array(n + 1).fill(0));
        const variance = Array(data.length + 1).fill(0).map(() => Array(n + 1).fill(0));
        for (let i = 1; i <= n; i++) {
            lower[1][i] = 1; variance[1][i] = 0;
            for (let j = 2; j <= data.length; j++) variance[j][i] = Infinity;
        }
        for (let l = 2; l <= data.length; l++) {
            let sum = 0, sumSq = 0, w = 0;
            for (let m = 1; m <= l; m++) {
                const i3 = l - m + 1;
                const val = data[i3 - 1];
                w++; sum += val; sumSq += val * val;
                const v = sumSq - (sum * sum) / w;
                if (i3 > 1) {
                    for (let j = 2; j <= n; j++) {
                        if (variance[l][j] >= v + variance[i3 - 1][j - 1]) {
                            lower[l][j] = i3;
                            variance[l][j] = v + variance[i3 - 1][j - 1];
                        }
                    }
                }
            }
            lower[l][1] = 1; variance[l][1] = sumSq - (sum * sum) / w;
        }
        const breaks = [data[0]];
        let k = data.length;
        for (let j = n; j >= 2; j--) {
            breaks.push(data[lower[k][j] - 2]);
            k = lower[k][j] - 1;
        }
        breaks.push(data[data.length - 1]);
        return breaks.sort((a, b) => a - b);
    }

    function computeBreaks(variable, method) {
        const values = geojsonData.features
            .map(f => parseValue(f.properties[variable]))
            .filter(v => !isNaN(v)).sort((a, b) => a - b);
        if (values.length === 0) return [];
        const k = 5;
        if (method === 'equal') {
            const min = values[0], max = values[values.length - 1];
            const step = (max - min) / k;
            return Array.from({ length: k + 1 }, (_, i) => min + i * step);
        }
        if (method === 'quantile') {
            return Array.from({ length: k + 1 }, (_, i) => values[Math.floor(i * (values.length - 1) / k)]);
        }
        return jenksBreaks(values, k);
    }

    // --- 4. RENDERIZADO ---
    function getColor(v, breaks, palette) {
        if (isNaN(v)) return '#333';
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i + 1]) return palette[i];
        }
        return palette[palette.length - 1];
    }

    function styleFeature(feature) {
        const v = parseValue(feature.properties[variableSelect.value]);
        return {
            fillColor: getColor(v, currentBreaks, currentPalette),
            weight: 1, color: '#fff', fillOpacity: 0.8
        };
    }

    function addLegend() {
        if (legend) map.removeControl(legend);
        legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            currentPalette.forEach((c, i) => {
                const item = document.createElement('div');
                item.className = 'range-item';
                item.style.background = c;
                item.dataset.min = currentBreaks[i];
                item.dataset.max = currentBreaks[i+1];
                item.innerText = currentBreaks[i+1].toLocaleString('pt-PT', { maximumFractionDigits: 1 });
                div.appendChild(item);
            });
            return div;
        };
        legend.addTo(map);
    }

    function updateMap() {
        if (!geojsonLayer) return;
        currentPalette = palettes[paletteSelect.value];
        currentBreaks = computeBreaks(variableSelect.value, classificationSelect.value);
        geojsonLayer.setStyle(styleFeature);
        addLegend();
        document.getElementById('mainTitle').innerText = variableSelect.value.toUpperCase();
    }

    // --- 5. ACCIONES DE USUARIO ---
    btnCargar.onclick = () => {
        fetch('barcelos.geojson') 
            .then(res => res.json())
            .then(data => {
                geojsonData = data;
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                
                geojsonLayer = L.geoJSON(data, {
                    style: styleFeature,
                    onEachFeature: (f, l) => {
                        l.on('mouseover', (e) => {
                            e.target.setStyle({ weight: 3, fillOpacity: 1 });
                            const val = parseValue(f.properties[variableSelect.value]);
                            document.querySelectorAll('.range-item').forEach(item => {
                                const min = parseFloat(item.dataset.min), max = parseFloat(item.dataset.max);
                                item.classList.toggle('highlighted', val >= min && val <= max);
                            });
                        });
                        l.on('mouseout', (e) => {
                            geojsonLayer.resetStyle(e.target);
                            document.querySelectorAll('.range-item').forEach(i => i.classList.remove('highlighted'));
                        });
                        l.bindTooltip(`<b>${f.properties[idSelect.value] || ''}</b><br>${variableSelect.value}: ${f.properties[variableSelect.value]}`, { sticky: true });
                    }
                }).addTo(map);
                
                map.fitBounds(geojsonLayer.getBounds());
                
                const props = data.features[0].properties;
                idSelect.innerHTML = ''; variableSelect.innerHTML = '';
                for (let k in props) {
                    idSelect.add(new Option(k, k));
                    if (!isNaN(parseValue(props[k]))) variableSelect.add(new Option(k, k));
                }
                updateMap();
            });
    };

    // --- FUNCIÓN DE EXPORTACIÓN A CSV (TU VERSIÓN INTEGRADA) ---
    btnExportar.onclick = () => {
        if (!geojsonData) {
            alert("Primero cargue los datos en el mapa.");
            return;
        }

        const firstFeature = geojsonData.features[0].properties;
        const headers = Object.keys(firstFeature).join(",");

        const rows = geojsonData.features.map(f => {
            return Object.values(f.properties).map(val => {
                let s = String(val).replace(/"/g, '""');
                if (s.includes(",")) s = `"${s}"`;
                return s;
            }).join(",");
        });

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `indicadores_barcelos_${variableSelect.value}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    [variableSelect, classificationSelect, paletteSelect].forEach(el => el.onchange = updateMap);
});