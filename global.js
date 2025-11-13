import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadTASData() {
    try {
    const tasData = await d3.csv('data/zonal_anomaly.csv');
    return tasData.map(d => ({
      year: +d.year,
      lat: +d.lat,
      tas: +d.tas
    }));
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

const tasData = await loadTASData();
console.log(tasData);

function renderTASChart(data) {

  // Define latitude bands
  const bands = [
    { name: "Tropics (-30°–30°)", min: -30, max: 30 },
    { name: "Mid-latitudes (30°–60°N)", min: 30, max: 60 },
    { name: "Arctic (60°–90°N)", min: 60, max: 90 }
  ];

  // Compute mean tas per year per band
  const bandData = bands.map(band => {
    const filtered = data.filter(d => d.lat >= band.min && d.lat <= band.max);
    const nested = d3.rollups(filtered, v => d3.mean(v, d => d.tas), d => d.year);
    return {
      name: band.name,
      values: nested.map(([year, tas]) => ({ year, tas }))
    };
  });

  // Flatten for global x/y domains
  const allValues = bandData.flatMap(d => d.values);

  // SVG setup
  const width = 800, height = 400;
  const margin = { top: 40, right: 120, bottom: 40, left: 60 };

  const svg = d3.select("#linechart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Scales
  const x = d3.scaleLinear()
    .domain(d3.extent(allValues, d => d.year))
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain(d3.extent(allValues, d => d.tas))
    .nice()
    .range([height, 0]);

  const color = d3.scaleOrdinal()
    .domain(bandData.map(d => d.name))
    .range(d3.schemeSet1);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(y));

  // Line generator
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.tas));

  // Draw lines
  svg.selectAll(".line")
    .data(bandData)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", d => color(d.name))
    .attr("stroke-width", 2)
    .attr("d", d => line(d.values));

  // Legend
  const legend = svg.selectAll(".legend")
    .data(bandData)
    .join("g")
    .attr("transform", (d, i) => `translate(${width + 10},${i * 25})`);

  legend.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d.name));

  legend.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text(d => d.name)
    .style("font-size", "12px");
}

renderTASChart(tasData);