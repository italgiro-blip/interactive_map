document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map', { zoomControl: false }).setView([41.5388, -8.6151], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    const paletteSelect = document.getElementById('paletteSelect');
    let geojsonLayer, legend, currentBreaks = [];

    const colorSchemes = {
        orange: ['#fff5cc', '#ffb84d', '#ff8c1a', '#e65c00', '#993d00'],
        viridis: ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'],
        magma: ['#000004', '#51127c', '#b63679', '#fb8861', '#fcfdbf'],
        greens: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        blues: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c']
    };

    let currentPalette = colorSchemes.orange;

    const getProp = (props, keys) => {
        const found = Object.keys(props).find(k => keys.includes(k.toLowerCase()));
        return found ? props[found] : null;
    };

    function getJenksBreaks(data, n) {
        data.sort((a, b) => a - b);
        const breaks = [data[0]];
        const step = Math.floor(data.length / n);
        for(let i=1; i<n; i++) breaks.push(data[i * step]);
        breaks.push(data[data.length - 1]);
        return breaks;
    }

    function computeBreaks(data, method) {
        const values = data.features.map(f => parseFloat(getProp(f.properties, ['taxa', 'rate'])) || 0).sort((a,b) => a-b);
        if (method === 'quartiles') {
            return [values[0], values[Math.floor(values.length * 0.25)], values[Math.floor(values.length * 0.5)], values[Math.floor(values.length * 0.75)], values[values.length - 1]];
        }
        if (method === 'equal') {
            const min = values[0], max = values[values.length-1];
            const step = (max - min) / 4;
            return Array.from({length: 5}, (_, i) => min + i * step);
        }
        return getJenksBreaks(values, 4);
    }

    function getColor(v, breaks) {
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i+1]) return currentPalette[i];
        }
        return currentPalette[currentPalette.length - 1];
    }

    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('barcelos.geojson')
            .then(res => res.json())
            .then(data => {
                currentBreaks = computeBreaks(data, classificationSelect.value);
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                labelSelect.innerHTML = '<option value="">Selecione...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => ({
                        fillColor: getColor(parseFloat(getProp(f.properties, ['taxa', 'rate'])) || 0, currentBreaks),
                        weight: 1, color: 'rgba(255,255,255,0.2)', fillOpacity: 0.7
                    }),
                    onEachFeature: (f, layer) => {
                        const nome = getProp(f.properties, ['nome', 'name', 'freguesia']);
                        const taxa = getProp(f.properties, ['taxa', 'rate']) || 0;
                        layer.on('click', () => seleccionarFreguesia(nome, taxa, layer));
                        labelSelect.add(new Option(nome, nome));
                    }
                }).addTo(map);
                addLegend();
                map.fitBounds(geojsonLayer.getBounds());
            });
    };

    function seleccionarFreguesia(nome, taxa, layer) {
        document.getElementById('detailNome').innerHTML = `<b>Nome:</b> ${nome}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Taxa:</b> ${taxa}%`;
        labelSelect.value = nome;

        // Reset Estilos y Tooltips
        geojsonLayer.eachLayer(l => {
            geojsonLayer.resetStyle(l);
            l.unbindTooltip(); 
        });

        // Resaltar Polígono y Etiqueta
        layer.setStyle({ color: '#fff', weight: 4, fillOpacity: 0.9 });
        layer.bindTooltip(`<b>${nome}</b><br>${taxa}%`, {
            direction: 'center', permanent: false, className: 'tooltip-selected'
        }).openTooltip();
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });

        // Sincronizar Leyenda
        document.querySelectorAll('.legend-item').forEach(el => el.classList.remove('active-legend'));
        document.querySelectorAll('.legend-item').forEach((item, index) => {
            if (taxa >= currentBreaks[index] && taxa <= currentBreaks[index + 1]) {
                item.classList.add('active-legend');
            }
        });
    }

    function addLegend() {
        if (legend) map.removeControl(legend);
        legend = L.control({position: 'bottomright'});
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend-horizontal');
            let html = '<div class="legend-container">';
            for (let i = 0; i < currentBreaks.length - 1; i++) {
                const color = currentPalette[i];
                const range = `${currentBreaks[i].toFixed(1)}-${currentBreaks[i+1].toFixed(1)}%`;
                html += `
                    <div class="legend-item" onmouseover="highlightRange(${currentBreaks[i]}, ${currentBreaks[i+1]})" onmouseout="resetHighlight()">
                        <div class="legend-color" style="background:${color}"></div>
                        <div class="legend-text">${range}</div>
                    </div>`;
            }
            div.innerHTML = html + '</div>';
            return div;
        };
        legend.addTo(map);
    }

    window.highlightRange = (min, max) => {
        geojsonLayer.eachLayer(layer => {
            const val = parseFloat(getProp(layer.feature.properties, ['taxa', 'rate'])) || 0;
            layer.setStyle(val >= min && val <= max ? { fillOpacity: 1, weight: 2, color: '#fff' } : { fillOpacity: 0.1, weight: 1 });
        });
    };

    window.resetHighlight = () => geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));

    labelSelect.onchange = (e) => {
        geojsonLayer.eachLayer(layer => {
            if (getProp(layer.feature.properties, ['nome', 'name']) === e.target.value) {
                seleccionarFreguesia(e.target.value, getProp(layer.feature.properties, ['taxa', 'rate']) || 0, layer);
            }
        });
    };

    paletteSelect.onchange = (e) => {
        currentPalette = colorSchemes[e.target.value];
        document.getElementById('btnCargarGeoJSON').click();
    };

    classificationSelect.onchange = () => document.getElementById('btnCargarGeoJSON').click();
});
