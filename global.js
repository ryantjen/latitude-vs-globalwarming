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

let userGroups = {
  1: new Set(),   // lat bands assigned to Group 1
  2: new Set(),   // Group 2
  3: new Set()    // Group 3
};

const latitudeBands = [
  { id: 0, min: -90, max: -60 },
  { id: 1, min: -60, max: -30 },
  { id: 2, min: -30, max: 0 },
  { id: 3, min: 0, max: 30 },
  { id: 4, min: 30, max: 60 },
  { id: 5, min: 60, max: 90 }
];

function updateChartFromGroups() {
    const groupedData = computeGroupAverages(tasData, userGroups, latitudeBands);
    renderTASChart(groupedData);
}

function renderLatMap(bands, userGroups) {
  const width = 120;
  const height = 400;

  const svg = d3.select("#latmap")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const y = d3.scaleBand()
    .domain(bands.map(b => b.id))
    .range([0, height])
    .padding(0.02);

  svg.selectAll("rect")
    .data(bands)
    .join("rect")
    .attr("x", 0)
    .attr("y", d => y(d.id))
    .attr("width", width)
    .attr("height", y.bandwidth())
    .attr("fill", "#ddd")
    .attr("stroke", "#555")
    .attr("data-id", d => d.id)
    .on("click", function (event, d) {
      handleBandClick(d.id);
      updateLatMapColors(svg, bands, userGroups);
      updateChartFromGroups();
    });

  updateLatMapColors(svg, bands, userGroups);
}

const groupColorScale = d3.scaleOrdinal()
    .domain([1, 2, 3])
    .range(d3.schemeSet1);

function updateLatMapColors(svg, bands, userGroups) {
  svg.selectAll("rect")
    .attr("fill", d => {
      for (let g = 1; g <= 3; g++) {
        if (userGroups[g].has(d.id)) return groupColorScale(g);
      }
      return "#ddd"; // default
    });
}

function handleBandClick(bandId) {
  // Remove from all groups first
  for (let g = 1; g <= 3; g++) {
    if (userGroups[g].has(bandId)) {
      userGroups[g].delete(bandId);

      // Cycle to next group
      if (g < 3) userGroups[g + 1].add(bandId);
      return;
    }
  }

  // If unassigned → assign to Group 1
  userGroups[1].add(bandId);
}

function computeGroupAverages(data, groups, bands) {
  const groupResults = [];

  for (let g = 1; g <= 3; g++) {
    const bandIds = groups[g];
    if (bandIds.size === 0) continue;

    const groupBandRanges = bands.filter(b => bandIds.has(b.id));

    const filtered = data.filter(d =>
      groupBandRanges.some(b => d.lat >= b.min && d.lat < b.max)
    );

    const nested = d3.rollups(
      filtered,
      v => d3.mean(v, d => d.tas),
      d => d.year
    );

    groupResults.push({
      name: `Group ${g}`,
      values: nested.map(([year, tas]) => ({ year, tas }))
    });
  }

  return groupResults;
}


function renderTASChart(groupedData) {

  d3.select("#linechart").selectAll("*").remove();

  const allValues = groupedData.flatMap(d => d.values);

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

  const color = d => {
    const g = Number(d.name.replace("Group ", ""));
    return groupColorScale(g);
  };
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
    .data(groupedData)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", d => color(d))
    .attr("stroke-width", 2)
    .attr("d", d => line(d.values));

  // Legend
  const legend = svg.selectAll(".legend")
    .data(groupedData)
    .join("g")
    .attr("transform", (d, i) => `translate(${width + 10},${i * 25})`);

  legend.append("rect")
    .attr("width", 12)
    .attr("height", 12)
    .attr("fill", d => color(d));

  legend.append("text")
    .attr("x", 18)
    .attr("y", 10)
    .text(d => d.name)
    .style("font-size", "12px");
}

renderLatMap(latitudeBands, userGroups);
updateChartFromGroups();