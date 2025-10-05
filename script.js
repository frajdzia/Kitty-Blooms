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

// Fetch MODIS NDVI data for Rzeszow neighbourhood (CSV)
// for one month with reduced data (bc of overload issues)
let dataByMonth = {};
const MAX_MARKERS = 20; // Hard cap to prevent overload
function loadMockData(month) {
    showLoader();
    dataByMonth = {}; // Clear previous data
    Papa.parse('data/filtered_scaled_250m_16_days_NDVI.csv', {
        download: true,
        header: true,
        complete: function(results) {
            console.log('CSV Data:', results.data);
            if (results.errors.length > 0) {
                console.error('CSV Parse Errors:', results.errors);
                // console.log('First row for debug:', results.data[0]); // Log first row to check format
                hideLoader();
                return;
            }
            let index = 0;
            let markersAdded = 0;
            results.data.forEach(row => {
                if (index % 100 === 0 && markersAdded < MAX_MARKERS) { // Sample every 100th row - for debugging
                    // Handle different possible column names
                    const lat = parseFloat(row.latitude || row.lat || row.Latitude);
                    const lng = parseFloat(row.longitude || row.lon || row.Longitude);
                    const ndvi = parseFloat(row.NDVI || row.value || row.ndvi);
                    const date = row.date || row.acquisition_date;
                    if (lat && lng && ndvi && date) {
                        const currentMonth = date.split('-')[1]; // Extract month from date
                        if (currentMonth === month && ['01', '02', '03', '04', '05', '06', '07', '08', '09'].includes(currentMonth)) {
                            if (!dataByMonth[currentMonth]) dataByMonth[currentMonth] = [];
                            if (lat >= 49.1 && lat <= 50.9 && lng >= 19.8 && lng <= 22.2 && ndvi >= 0.5) {
                                dataByMonth[currentMonth].push({
                                    lat: lat,
                                    lng: lng,
                                    ndvi: ndvi
                                });
                                markersAdded++;
                            }
                        }
                    } else {
                        console.warn('Skipping row due to missing data:', row);
                    }
                }
                index++;
            });
            console.log('Data by Month:', dataByMonth);
            if (!dataByMonth[month]) {
                console.warn('No valid NDVI data in CSV for month:', month);
            }
            updateMap(month); // Update map with the selected month
            hideLoader();
        },
        error: function(err) {
            console.error('CSV Load Error:', err);
            hideLoader();
        }
    });
}

// Initial load for July
loadMockData('07');

// Update map based on slider (reload data for selected month)
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

    const months = { '01': 'January 2025', '02': 'February 2025', '03': 'March 2025', '04': 'April 2025', '05': 'May 2025', '06': 'June 2025', '07': 'July 2025', '08': 'August 2025', '09': 'September 2025' };
    document.getElementById('monthLabel').textContent = months[month] || 'Month';
}

document.getElementById('monthSlider').addEventListener('input', function() {
    const month = ['01', '02', '03', '04', '05', '06', '07', '08', '09'][this.value];
    loadMockData(month); // Reload data for the selected month
});

// train and predict on click (work in progress, commented for now)
/*
function trainModel(coordinates) {
    const nn = ml5.neuralNetwork({ task: 'regression', noTraining: true });
    const trainingData = ['07', '08', '09'].map((month, index) => {
        const point = dataByMonth[month]?.find(p => 
            Math.abs(p.lat - coordinates.lat) < 0.1 && abs(p.lng - coordinates.lng) < 0.1
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