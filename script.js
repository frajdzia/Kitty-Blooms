// Initialize Leaflet map centered on Rzeszow
const map = L.map('map').setView([50, 21], 8); // Rzeszow location
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

let currentMarkers = [];
const nn = ml5.neuralNetwork({ task: 'regression', noTraining: true });

// Show/hide loader
const loader = document.getElementById('loader');
function showLoader() { loader.style.display = 'block'; }
function hideLoader() { loader.style.display = 'none'; }

// Fetch MODIS NDVI data for Rzeszow region (CSV)
let dataByMonth = {};
function loadMockData() {
    showLoader();
    Papa.parse('data/filtered_scaled_250m_16_days_NDVI.csv', {
        download: true,
        header: true,
        complete: function(results) {
            console.log('CSV Data:', results.data);
            if (results.errors.length > 0) {
                console.error('CSV Parse Errors:', results.errors);
                hideLoader();
                return;
            }
            results.data.forEach(row => {
                if (row.latitude && row.longitude && row.NDVI && row.date) {
                    const month = row.date.split('-')[1]; // Extract month from date
                    if (!['07', '08', '09'].includes(month)) return; // Limit to July-Sep
                    if (!dataByMonth[month]) dataByMonth[month] = [];
                    const lat = parseFloat(row.latitude);
                    const lng = parseFloat(row.longitude);
                    const ndvi = parseFloat(row.NDVI);
                    // Filter for 100 km around Rzeszow (approx 49.1-50.9N, 19.8-22.2E)
                    if (lat >= 49.1 && lat <= 50.9 && lng >= 19.8 && lng <= 22.2 && ndvi >= 0.5) {
                        dataByMonth[month].push({
                            lat: lat,
                            lng: lng,
                            ndvi: ndvi
                        });
                    }
                }
            });
            console.log('Data by Month:', dataByMonth);
            if (Object.keys(dataByMonth).length === 0) {
                console.warn('No valid NDVI data in CSV for Rzeszow region');
            }
            updateMap('07'); // Start with July 2025
            hideLoader();
        },
        error: function(err) {
            console.error('CSV Load Error:', err);
            hideLoader();
        }
    });
}
loadMockData(); // Trigger mock data load

// Update map based on slider
function updateMap(month) {
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];

    console.log('Updating map for month:', month);
    if (dataByMonth[month]) {
        dataByMonth[month].forEach(point => {
            const marker = L.circleMarker([point.lat, point.lng], {
                radius: 5,
                fillColor: '#ff69b4', // Pink for blooming
                color: '#ff69b4',
                weight: 1,
                fillOpacity: Math.min(point.ndvi, 0.8),
                opacity: 0.8
            }).addTo(map);
            currentMarkers.push(marker);
        });
        console.log('Markers added:', currentMarkers.length);
    } else {
        console.warn('No data for month:', month);
    }

    const months = { '07': 'July 2025', '08': 'August 2025', '09': 'September 2025' };
    document.getElementById('monthLabel').textContent = months[month] || 'Month';
}

document.getElementById('monthSlider').addEventListener('input', function() {
    const month = ['07', '08', '09'][this.value];
    updateMap(month);
});

// Train and predict on click (work in progress, commented for now)
/*
function trainModel(coordinates) {
    const nn = ml5.neuralNetwork({ task: 'regression', noTraining: true });
    const trainingData = ['07', '08', '09'].map((month, index) => {
        const point = dataByMonth[month]?.find(p => 
            Math.abs(p.lat - coordinates.lat) < 0.1 && Math.abs(p.lng - coordinates.lng) < 0.1
        );
        return point ? { month: index + 7, ndvi: point.ndvi } : null;
    }).filter(Boolean);

    console.log('Training Data:', trainingData);
    if (trainingData.length < 2 || trainingData.some(d => isNaN(d.ndvi))) {
        return { trained: false, model: null };
    }
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
*/