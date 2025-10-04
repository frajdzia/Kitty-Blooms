// Initialize Leaflet map centered on Poland
const map = L.map('map').setView([52, 19], 6); // Center on Poland, zoom level 6
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Initialize ML model
const nn = ml5.neuralNetwork({ task: 'regression', noTraining: true });

// Fetch current MODIS NDVI data for Poland region
let dataByMonth = {};
async function fetchData() {
    try {
        const response = await fetch('https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset?latitude=52&longitude=19&startDate=A2024193&endDate=A2024273&kmAboveBelow=50&kmLeftRight=50');
        if (!response.ok) throw new Error('API request failed: ' + response.status);
        const data = await response.json();
        console.log('API Data:', data); // Debug
        if (!data.subset || !Array.isArray(data.subset)) {
            throw new Error('Invalid or empty subset in API response');
        }
        data.subset.forEach(point => {
            if (!point.modis_date || typeof point.modis_date !== 'string' || point.band !== '250m_16_days_NDVI' || !point.calendar_date) {
                console.warn('Skipping point:', point);
                return;
            }
            const month = point.calendar_date.split('-')[1]; // Extract month from calendar_date (e.g., "07")
            if (!dataByMonth[month]) dataByMonth[month] = [];
            dataByMonth[month].push({
                lat: parseFloat(point.latitude),
                lng: parseFloat(point.longitude),
                ndvi: point.value / 10000 // Scale to 0–1
            });
        });
        console.log('Data by Month:', dataByMonth); // Debug
        if (Object.keys(dataByMonth).length === 0) {
            console.warn('No valid NDVI data parsed from API, using CSV fallback');
        }
        updateMap('07'); 

    } catch (error) {
        console.error('Fetch Error:', error);
        // Fallback to CSV
        try {
            Papa.parse('data/modis_ndvi.csv', {
                download: true,
                header: true,
                complete: function(results) {
                    console.log('CSV Data:', results.data); // Debug
                    if (results.errors.length > 0) {
                        console.error('CSV Parse Errors:', results.errors);
                        return;
                    }
                    results.data.forEach(row => {
                        if (!row.date || !row.latitude || !row.longitude || !row.NDVI) {
                            console.warn('Skipping invalid CSV row:', row);
                            return;
                        }
                        const month = row.date.split('-')[1];
                        if (!dataByMonth[month]) dataByMonth[month] = [];
                        dataByMonth[month].push({
                            lat: parseFloat(row.latitude),
                            lng: parseFloat(row.longitude),
                            ndvi: parseFloat(row.NDVI)
                        });
                    });
                    console.log('Data by Month (CSV):', dataByMonth); // Debug
                    updateMap('07');
                },
                error: function(err) {
                    console.error('CSV Load Error:', err);
                }
            });
        } catch (csvError) {
            console.error('CSV Fallback Failed:', csvError);
        }
    }
}
fetchData();

// Update map based on slider
let currentMarkers = [];
function updateMap(month) {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    console.log('Updating map for month:', month); // Debug
    if (dataByMonth[month]) {
        dataByMonth[month].forEach(point => {
            console.log('Point:', point); // Debug
            if (point.ndvi > 0.1) { // Low threshold for Poland
                const marker = L.circleMarker([point.lat, point.lng], {
                    radius: 5,
                    color: '#ff69b4', // Pink for blooms mock color
                    fillColor: '#ff69b4',
                    fillOpacity: point.ndvi
                }).addTo(map);
                currentMarkers.push(marker);
            }
        });
    }
    console.log('Markers added:', currentMarkers.length); // Debug

    const months = { '07': 'July 2024', '08': 'August 2024', '09': 'September 2024' };
    document.getElementById('monthLabel').textContent = months[month];
}

document.getElementById('monthSlider').addEventListener('input', function() {
    const month = ['07', '08', '09'][this.value];
    updateMap(month);
});

// ML: Train and predict on click
function trainModel(coordinates) {
    const nn = ml5.neuralNetwork({ task: 'regression', noTraining: true });
    const trainingData = ['07', '08', '09'].map((month, index) => {
        const point = dataByMonth[month]?.find(p => 
            Math.abs(p.lat - coordinates.lat) < 0.1 && Math.abs(p.lng - coordinates.lng) < 0.1
        );
        return point ? { month: index + 7, ndvi: point.ndvi } : null;
    }).filter(Boolean);

    console.log('Training Data:', trainingData); // Debug
    if (trainingData.length < 2) return { trained: false, model: null };
    trainingData.forEach(data => nn.addData({ month: data.month }, { ndvi: data.ndvi }));
    nn.normalizeData();
    nn.train({ epochs: 50 }, () => console.log('Model trained'));
    return { trained: true, model: nn };
}

function predictNDVI(model, coordinates, callback) {
    if (!model) {
        callback(null);
        return;
    }
    model.predict({ month: 10 }, (err, results) => {
        if (err) {
            console.error('Prediction Error:', err);
            callback(null);
        } else {
            callback(results[0].ndvi);
        }
    });
}

map.on('click', function(e) {
    const clickedLat = e.latlng.lat;
    const clickedLng = e.latlng.lng;
    const { trained, model } = trainModel({ lat: clickedLat, lng: clickedLng });
    if (trained) {
        predictNDVI(model, { lat: clickedLat, lng: clickedLng }, (ndvi) => {
            if (ndvi !== null) {
                L.popup()
                    .setLatLng([e.latlng.lat, e.latlng.lng])
                    .setContent(`Predicted NDVI for October: ${ndvi.toFixed(2)}`)
                    .openOn(map);
            } else {
                L.popup()
                    .setLatLng([e.latlng.lat, e.latlng.lng])
                    .setContent('No data to predict')
                    .openOn(map);
            }
        });
    } else {
        L.popup()
            .setLatLng([e.latlng.lat, e.latlng.lng])
            .setContent('Need at least 2 months of data to predict')
            .openOn(map);
    }
});