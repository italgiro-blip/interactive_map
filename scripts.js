document.addEventListener('DOMContentLoaded', () => {
    // 1. Configuración inicial del mapa
    const map = L.map('map', { zoomControl: false }).setView([41.5388, -8.6151], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    const labelSelect = document.getElementById('labelSelect');
    const classificationSelect = document.getElementById('classificationSelect');
    let geojsonLayer, legend, currentBreaks = [];
    const palette = ['#fff5cc', '#ffb84d', '#ff8c1a', '#e65c00', '#993d00'];

    // Helper para encontrar propiedades sin importar mayúsculas/minúsculas
    const getProp = (props, keys) => {
        const found = Object.keys(props).find(k => keys.includes(k.toLowerCase()));
        return found ? props[found] : null;
    };

    // Lógica de colores y clasificación
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
        if (method === 'equal') {
            const min = values[0], max = values[values.length-1];
            const step = (max - min) / 5;
            return Array.from({length: 6}, (_, i) => min + i * step);
        }
        return getJenksBreaks(values, 5);
    }

    function getColor(v, breaks) {
        for (let i = 0; i < breaks.length - 1; i++) {
            if (v >= breaks[i] && v <= breaks[i+1]) return palette[i];
        }
        return palette[4];
    }

    // --- FUNCIÓN CLAVE: Sincroniza Mapa + UI ---
    function seleccionarFreguesia(nome, taxa, layer) {
        // Actualizar Cuadro de Información
        document.getElementById('detailNome').innerHTML = `<b>Nome:</b> ${nome}`;
        document.getElementById('detailTaxa').innerHTML = `<b>Taxa:</b> ${taxa}%`;
        
        // Actualizar el valor del Select (si no viene del select mismo)
        labelSelect.value = nome;

        // Resetear estilos anteriores y resaltar el seleccionado
        if (geojsonLayer) {
            geojsonLayer.eachLayer(l => geojsonLayer.resetStyle(l));
        }
        
        layer.setStyle({
            color: '#fff',
            weight: 3,
            fillOpacity: 0.9,
            dashArray: ''
        });
        
        layer.bringToFront();
        map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    }

    // Carga de Datos
    document.getElementById('btnCargarGeoJSON').onclick = () => {
        fetch('barcelos.geojson')
            .then(res => res.json())
            .then(data => {
                currentBreaks = computeBreaks(data, classificationSelect.value);
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                
                // Limpiar select
                labelSelect.innerHTML = '<option value="">Selecione uma freguesia...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: (f) => ({
                        fillColor: getColor(parseFloat(getProp(f.properties, ['taxa', 'rate'])) || 0, currentBreaks),
                        weight: 1, color: 'rgba(255,255,255,0.3)', fillOpacity: 0.7
                    }),
                    onEachFeature: (f, layer) => {
                        const nome = getProp(f.properties, ['nome', 'name', 'freguesia']);
                        const taxa = getProp(f.properties, ['taxa', 'rate']) || 0;
                        
                        layer.bindTooltip(`<b>${nome}</b>`);

                        // Evento Click en el Mapa
                        layer.on('click', () => {
                            seleccionarFreguesia(nome, taxa, layer);
                        });

                        // Llenar el Select
                        const option = new Option(nome, nome);
                        labelSelect.add(option);
                    }
                }).addTo(map);

                addLegend();
                map.fitBounds(geojsonLayer.getBounds());
            });
    };

    // Evento Cambio en el Select (Desplegable)
    labelSelect.onchange = (e) => {
        const val = e.target.value;
        if (!val) return;

        geojsonLayer.eachLayer(layer => {
            const nomeLayer = getProp(layer.feature.properties, ['nome', 'name', 'freguesia']);
            if (nomeLayer === val) {
                const taxa = getProp(layer.feature.properties, ['taxa', 'rate']) || 0;
                seleccionarFreguesia(nomeLayer, taxa, layer);
            }
        });
    };

    function addLegend() {
        if (legend) map.removeControl(legend);
        legend = L.control({position: 'bottomright'});
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = '<b style="display:block; margin-bottom:5px;">Taxa de Análise</b>';
            for (let i = 0; i < currentBreaks.length - 1; i++) {
                div.innerHTML += `<i style="background:${palette[i]}"></i> ${currentBreaks[i].toFixed(1)} - ${currentBreaks[i+1].toFixed(1)}%<br>`;
            }
            return div;
        };
        legend.addTo(map);
    }

    classificationSelect.onchange = () => document.getElementById('btnCargarGeoJSON').click();
});
