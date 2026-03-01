document.addEventListener('DOMContentLoaded', () => {
    // Inicializar mapa en Barcelos
    const map = L.map('map', { zoomControl: false }).setView([41.5388, -8.6151], 12);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }).addTo(map);

    const labelSelect = document.getElementById('labelSelect');
    const detailNome = document.getElementById('detailNome');
    const detailTaxa = document.getElementById('detailTaxa');
    let geojsonLayer;

    // Lógica Sayayin para obtener propiedades sin importar mayúsculas/minúsculas
    const getProp = (props, keys) => {
        const found = Object.keys(props).find(k => keys.includes(k.toLowerCase()));
        return found ? props[found] : null;
    };

    document.getElementById('btnCargarGeoJSON').onclick = () => {
        // Asegúrate de que el archivo esté en la misma carpeta
        fetch('barcelos.geojson')
            .then(res => {
                if (!res.ok) throw new Error("Arquivo não encontrado");
                return res.json();
            })
            .then(data => {
                if (geojsonLayer) map.removeLayer(geojsonLayer);
                labelSelect.innerHTML = '<option value="">Selecione...</option>';

                geojsonLayer = L.geoJSON(data, {
                    style: {
                        color: '#ff8c1a', weight: 1.5, fillOpacity: 0.3, fillColor: '#222'
                    },
                    onEachFeature: (feature, layer) => {
                        const props = feature.properties;
                        // Buscamos "nome" o "taxa" en cualquier formato
                        const nome = getProp(props, ['nome', 'name', 'freguesia']) || "N/A";
                        const taxa = getProp(props, ['taxa', 'rate', 'valor']) || "0";

                        // Tooltip
                        layer.bindTooltip(`<b>${nome}</b>`, { sticky: true });

                        // Evento Click
                        layer.on('click', () => {
                            actualizarInfo(nome, taxa);
                            highlightFeature(layer);
                        });

                        // Llenar el selector
                        const option = new Option(nome, nome);
                        labelSelect.add(option);
                    }
                }).addTo(map);

                map.fitBounds(geojsonLayer.getBounds());
            })
            .catch(err => alert("Erro: " + err.message));
    };

    function actualizarInfo(n, t) {
        detailNome.innerHTML = `📍 Freguesia: <b>${n}</b>`;
        detailTaxa.innerHTML = `📈 Taxa: <b>${t}%</b>`;
    }

    function highlightFeature(layer) {
        geojsonLayer.resetStyle();
        layer.setStyle({ fillOpacity: 0.7, weight: 3, fillColor: '#ff8c1a' });
        map.panTo(layer.getBounds().getCenter());
    }

    // Buscador/Selector
    labelSelect.onchange = (e) => {
        const val = e.target.value;
        geojsonLayer.eachLayer(layer => {
            const nome = getProp(layer.feature.properties, ['nome', 'name', 'freguesia']);
            if (nome === val) {
                map.fitBounds(layer.getBounds());
                layer.openTooltip();
                actualizarInfo(nome, getProp(layer.feature.properties, ['taxa', 'rate', 'valor']));
                highlightFeature(layer);
            }
        });
    };
});
