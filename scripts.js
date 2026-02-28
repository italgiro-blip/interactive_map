// 1. INICIALIZACIÓN INMEDIATA DEL MAPA
const map = L.map('map', {
    center: [41.5388, -8.6151],
    zoom: 12
});

// Forzar carga de tiles oscuros de inmediato
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
}).addTo(map);

// Reparar el tamaño del mapa por si el CSS tardó un milisegundo
setTimeout(() => { map.invalidateSize(); }, 500);

// 2. VARIABLES GLOBALES
let geojsonData, geojsonLayer, legend;
const palettes = {
    fire:   ['#fff5cc','#ffb84d','#ff8c1a','#e65c00','#993d00'],
    azure:  ['#ffffff','#cdd3ec','#7f8dc6','#555fa3','#2a3180'],
    green:  ['#e5f5e0','#a1d99b','#74c476','#31a354','#006d2c'],
    red:    ['#fee0d2','#fc9272','#fb6a4a','#de2d26','#a50f15'],
    blue:   ['#e0f3f8','#abd9e9','#74add1','#4575b4','#313695']
};

// 3. FUNCIONES DE APOYO
function parseValue(val) {
    if (val === null || val === undefined) return NaN;
    return parseFloat(val.toString().replace(/\./g, '').replace(',', '.').trim());
}

// (Aquí va tu función jenksBreaks exacta que ya tienes)
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

// 4. LÓGICA DE ACTUALIZACIÓN
function updateMap() {
    if (!geojsonLayer) return;
    const variable = document.getElementById('variableSelect').value;
    const palette = palettes[document.getElementById('paletteSelect').value];
    const method = document.getElementById('classificationSelect').value;
    
    const breaks = computeBreaks(variable, method);

    geojsonLayer.setStyle(f => {
        const v = parseValue(f.properties[variable]);
        let color = '#333';
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i + 1]) color = palette[i];
        }
        return { fillColor: color, weight: 1, color: '#fff', fillOpacity: 0.8 };
    });

    // Leyenda
    if (legend) map.removeControl(legend);
    legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'legend');
        palette.forEach((c, i) => {
            const item = document.createElement('div');
            item.className = 'range-item';
            item.style.background = c;
            item.innerText = breaks[i+1].toFixed(0);
            div.appendChild(item);
        });
        return div;
    };
    legend.addTo(map);
}

// 5. BOTÓN CARGAR (EL FETCH)
document.getElementById('btnCargarGeoJSON').onclick = () => {
    fetch('barcelos.geojson')
        .then(res => res.json())
        .then(data => {
            geojsonData = data;
            if (geojsonLayer) map.removeLayer(geojsonLayer);
            
            geojsonLayer = L.geoJSON(data, {
                onEachFeature: (f, l) => {
                    l.bindTooltip(`${f.properties.NAME || 'Dato'}`);
                }
            }).addTo(map);
            
            map.fitBounds(geojsonLayer.getBounds());

            // Llenar selects
            const props = data.features[0].properties;
            const vSelect = document.getElementById('variableSelect');
            const iSelect = document.getElementById('idSelect');
            vSelect.innerHTML = ''; iSelect.innerHTML = '';
            
            for (let k in props) {
                iSelect.add(new Option(k, k));
                if (!isNaN(parseValue(props[k]))) vSelect.add(new Option(k, k));
            }
            updateMap();
        })
        .catch(err => alert("Error: Verifica que el archivo barcelos.geojson esté en la carpeta y estés usando Live Server."));
};

// Eventos de cambio
document.getElementById('variableSelect').onchange = updateMap;
document.getElementById('paletteSelect').onchange = updateMap;
document.getElementById('classificationSelect').onchange = updateMap;
