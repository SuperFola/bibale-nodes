function generateWeb(data) {
	var o = data;
	o.web = [];
	var mapping = {};  // id => index
	
	for (var i=0; i < o.nodes.length; i++) {
		o.web.push({
			id: o.nodes[i].id
			, targets: []
			, data: null
		});
		mapping[o.nodes[i].id] = i;
	}
	
	for (var i=0; i < o.links.length; i++) {
		o.web[mapping[o.links[i].source]].targets.push(o.links[i].target);
		o.web[mapping[o.links[i].source]].data = getNodeByName(o.links[i].source, data.nodes).data;
		if (getNodeByName(o.links[i].source, data.nodes).hasOwnProperty("enhanced_label"))
			o.web[mapping[o.links[i].source]].enhanced_label = true;
		
		o.web[mapping[o.links[i].target]].targets.push(o.links[i].source);
		o.web[mapping[o.links[i].target]].data = getNodeByName(o.links[i].target, data.nodes).data;
		if (getNodeByName(o.links[i].target, data.nodes).hasOwnProperty("enhanced_label"))
			o.web[mapping[o.links[i].target]].enhanced_label = true;
	}
	
	return o;
}

// to retrieve a node only by knowing its name
function getNodeByName(name, nodes) {
	for (var i=0; i < nodes.length; i++) {
		if (nodes[i].id == name)
			return nodes[i];
	}
	return {x: 0, y: 0, id: name, targets: []};
}

function simulate(obj) {
	// select svg, get its size
	var svg = d3.select(obj.id),
		width = +svg.attr("width"),
		height = +svg.attr("height");
	
	// create a d3 simulation for many bodies and adjust center
	var simulation = d3.forceSimulation()
		.force("link"
			, d3.forceLink()
				.id(d => d.id)
				.distance(58)
			)
		.force("charge", d3.forceManyBody())
		.force("center", d3.forceCenter(width / 2, height / 2));
	
	// get a nice color scheme
	var color = d3.scaleOrdinal(d3.schemeCategory20);
	
	// set the position of the text
	var textPos = d => {
		var x = d.x + 14; var y = d.y + 5;
		if (x != NaN && y != NaN)
			return `translate(${x}, ${y})`;
		return "translate(0, 0)";
	};
	
	// just to be able to drag around all this little thing
	function dragstarted(d) {
		if (!d3.event.active) simulation.alphaTarget(0.3).restart();
		d.fx = d.x; d.fy = d.y;
	}
	
	function dragged(d) {
		d.fx = d3.event.x;
		d.fy = d3.event.y;
	}
	
	function dragended(d) {
		if (!d3.event.active) simulation.alphaTarget(0);
		d.fx = null; d.fy = null;
	}
	
	var drag = (simulation => {
		return d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended);
	});
	
	function f(error, graph) {
		if (error) throw error;
		graph = generateWeb(graph);
		
		const link = svg.append("g")
				.attr("class", "links")
			.selectAll("line")
			.data(graph.links)
			.enter().append("line")
				.attr("stroke-width", d => Math.sqrt(d.value));
		
		const node = svg.append("g")
				.attr("class", "nodes")
			.selectAll("circle")
			.data(graph.nodes)
			.enter().append("circle")
				.attr("r", d => {
					if (!obj.hasOwnProperty("radius"))
						return 10;
					return obj.radius(d);
				})
				.attr("fill", d => color(d.group))
				.call(drag(simulation));
		
		const text = svg.append("g")
			.selectAll("g")
			.data(graph.web)
			.enter().append("g")
				.call(drag(simulation));
		
		text.append("text")
			.attr("transform", textPos)
			.attr("class", d => {
					if (obj.hasOwnProperty("text_styling"))
						return obj.text_styling(d);
					return "labels-basics";
				})
			.text(d => {
				if (!obj.hasOwnProperty("text"))
					return d.id;
				return obj.text(d);
			});
		
		node
			.on("click", function(d) {
				if (obj.hasOwnProperty("onclick"))
					obj.onclick(d);
			})
			.on("mouseover", function(d) {
				if (obj.hasOwnProperty("onmouseover"))
					obj.onmouseover(d);
				// displaying all the links & texts from/to this node
				link.style("stroke-opacity", function(L) {
					if (d === L.source || d === L.target)
						return 1.0;
					return 0.2;
				});
				text.style("opacity", function(t) {
					if (d.id === t.id || t.targets.indexOf(d.id) > -1)
						return 1.0;
					return 0.3;
				});
			})
			.on("mouseout", function(d) {
				if (obj.hasOwnProperty("onmouseout"))
					obj.onmouseout(d);
				// hiding all the links & texts from/to this node
				link.style("stroke-opacity", 0.6);
				text.style("opacity", 0.3);
			});
		
		text
			.on("mouseover", function(d) {
				// displaying all the  & texts from/to this text
				link.style("stroke-opacity", function(L) {
					if (d.id === L.source.id || d.id === L.target.id)
						return 1.0;
					return 0.2;
				});
				text.style("opacity", function(t) {
					if (d.id === t.id || t.targets.indexOf(d.id) > -1)
						return 1.0;
					return 0.3;
				});
			})
			.on("mouseout", function(d) {
				if (obj.hasOwnProperty("onmouseout"))
					obj.onmouseout(d);
				// hiding all the links & texts from/to this text
				link.style("stroke-opacity", 0.6);
				text.style("opacity", 0.3);
			});
		
		simulation
			.nodes(graph.nodes)
			.on("tick", ticked);
		
		simulation.force("link")
			.links(graph.links);
		
		function ticked() {
			link
				.attr("x1", d => d.source.x)
				.attr("y1", d => d.source.y)
				.attr("x2", d => d.target.x)
				.attr("y2", d => d.target.y);
			
			node
				.attr("cx", d => d.x)
				.attr("cy", d => d.y);
			
			text
				.attr("transform", d => textPos(getNodeByName(d.id, graph.nodes)));
		}
	}
	
	// loading json file and creating links and nodes
	if (typeof obj.data === 'string')
		d3.json(obj.data, f);
	else if (typeof obj.data === 'object')
		f(false, obj.data);
	
	return svg;
}