const reset = () => $("#sketchbook").html("");

function displayInfo(d) {
	$("#info").css("display", "inline-block");
	
	let t = "";
	
	// root
	if (d.data.hasOwnProperty("data") || d.hasOwnProperty("root")) {
		for (var i=0; i < d.data.data.length; i++) {
			t += "<b>"; t += d.data.data[i].type.toTitleCase(); t += "</b> ";
			t += d.data.data[i].value;
			t += "<br>";
			t += "<br>";
		}
	} else {
		if (d.data.type !== "..." && d.data.type !== "category") {
			t += "<b>"; t += `${d.data.type.toTitleCase()}`; t += "</b> ";
			t += d.data.notice;
			t += "<br>";
			
			if (d.data.hasOwnProperty("date")) {
				t += "<b>Date</b> ";
				t += d.data.date;
				t += "<br>";
			}
			
			if (d.data.hasOwnProperty("lieu")) {
				t += "<b>Lieu</b> ";
				t += d.data.lieu;
				t += "<br>";
			}
			
			if (d.data.hasOwnProperty("commentaire")) {
				t += "<b>Commentaire</b> ";
				t += d.data.commentaire;
				t += "<br>";
			}
			
			t += "<a href=\"#\" onclick=\"reset(); justDoIt("; t += d.data.id; t += ");\">Visualiser</a>&nbsp;&nbsp;";
		} else if (d.data.type === "...") {
			t += "<nav><ul class=\"moredata no-li\">";
			for (var i=0; i < d.data.moredata.length; i++) {
				t += "<li><a href=\"#\" onclick=\"reset(); justDoIt("; t += d.data.moredata[i].id; t += ");\">"; t += d.data.moredata[i].notice; t += "</a></li>";
			}
			t += "</ul></nav>";
			t += "<br>";
		} else if (d.data.type === "category") {
			t += "<b>"; t += d.data.notice; t += "</b>";
		}
	}
	
	if (d.data.type !== "category") {
		t += "<a href=\"http://bibale.irht.cnrs.fr/";
			t += d.data.id.toString();
		t += "\" target=\"_blank\">Consulter</a>";
	}
	t += "<a href=\"#\" style=\"float: right\" class=\"glyphicon glyphicon-share\" onclick=\"copyToClipboard('";
		t += "?id=" + d.data.id.toString() + "&level=1";
	t += "')\">Partager</a>"
	
	$("#info").html(t);
}

const api_request = (async (resx_id) => {
	const response = await fetch(`assets/json/${resx_id}.json`);
	const json = await response.json();
	return json;
});

const main = ((id_) => {
	var id;
	if (id_ == -1) {
		id = findGetParameter("id");
		if (id !== null && id !== undefined && isNaN(id) == false)
			id = (+id);
		else
			throw "Impossible de trouver la ressource d'identifiant " + id.toString();
	} else {
		id = id_;
	}
	
	var level = findGetParameter("level");
	if (level === null || level === undefined)
		level = 1;
	else if (isNaN(level) == false) {
		level = (+level);
		if (level < 1 || level > 2)
			throw "Le niveau de récursion concernant l'affichage des données est incorrect.<br>Il doit être compris dans [1, 2]";
	} else
		throw "Le niveau de récursion concernant l'affichage des données est incorrect : " + level.toString();
	
	(async (resx_id) => {
		simulate({
			id: "#sketchbook"
			, data: await formatData(resx_id, level)
			, text: d => {
				if (d.data != null)
					return d.data.notice;
				return "null";
			}
			, onclick: d => displayInfo(d)
			, onmouseover: d => 0
			, onmouseout: d => 0
			, radius: d => {
				if (d.hasOwnProperty("not_data"))
					return 5;
				return 10;
			}
			, text_styling: d => {
				if (d.hasOwnProperty("enhanced_label"))
					return "labels-but-better";
				return "labels-basics";
			}
		});
	})(id);
});

const findIt = ((it, container) => {
	for (var i=0; i < container.length; i++) {
		if (deepCompare(it, container[i]))
			return true;
	}
	return false;
});

const makeLayer = (async (output, level, resx_id, origin=0) => {
	let json = await api_request(resx_id);
	let g_num = 1000 * (level + 1);
	let categories = [];
	output.id = json.id;
	
	output.data = json.data;
	output.data.id = resx_id;
	// first node which will be linked to all associations
	if (origin === 0) {
		output.nodes.push({
			id: json.id
			, group: g_num
			, data: {
				id: resx_id
				, notice: json.id
				, data: json.data
			}
			, enhanced_label: true
			, root: true
		});
	}
	
	// adding the categories
	for (var key in json.associations) {
		for (var i=0; i < json.associations[key].length; i++) {
			if (categories.includes(key) == false) {
				output.nodes.push({
					id: key + resx_id.toString()
					, group: ++g_num
					, data: {
						notice: key.toTitleCase()
						, type: "category"
					}
					, not_data: true
					, enhanced_label: true
				});
				categories.push(key);
				
				let src = origin;
				if (src === 0)
					src = json.id;
				
				output.links.push({
					source: src
					, target: key + resx_id.toString()
					, value: 5
				});
			}
		}
	}
	
	// adding the elements
	var uid = g_num + 1000 * resx_id;
	for (var key in json.associations) {
		let s = json.associations[key].length;
		for (var i=0; i < (5 > s ? s : 5) ; i++) {
			output.nodes.push({
				id: ++uid
				, group: g_num
				, data: json.associations[key][i]
			});
			
			output.links.push({
				source: key + resx_id.toString()
				, target: uid
				, value: 2
			});
			
			if (level > 0) {
				let temp = {nodes: [], links: [], data: null};
				temp = await makeLayer(temp, level - 1, json.associations[key][i].id, uid);
				
				output.nodes[output.nodes.length - 1].data = {id: temp.data.id, data: temp.data, notice: temp.id};
				output.nodes[output.nodes.length - 1].root = true;
				output.nodes[output.nodes.length - 1].enhanced_label = true;
				
				console.log(temp);
				if (temp.data != null) {
					for (var i=0; i < temp.nodes.length; i++) {
						if (!findIt(temp.nodes[i], output.nodes))
							output.nodes.push(temp.nodes[i]);
					}
					for (var i=0; i < temp.links.length; i++) {
						if (!findIt(temp.links[i], output.links))
							output.links.push(temp.links[i]);
					}
				}
			}
		}
		
		if (s > 5) {
			let d = {
				id: -1
				, notice: "(...)"
				, type: "..."
				, moredata: []
			};
			for (var i=4; i < json.associations[key].length; ++i)
				d.moredata.push(json.associations[key][i]);
			
			output.nodes.push({
				id: ++uid
				, group: g_num
				, data: d
			});
			output.links.push({
				source: key + resx_id.toString()
				, target: uid
				, value: 10
			});
		}
		g_num++;
	}
	
	return output;
});

const formatData = (async (resx_id, level) => {
	var output = {
		nodes: []
		, links: []
		, data: null
	};
	output = makeLayer(output, --level, resx_id);
	
	return output;
});

const justDoIt = ((id=-1) => {
	try {
		main(id);
	} catch (error) {
		$("#error").css("display", "initial");
		$("#error").html(
			"<b>Erreur</b> " + error.toString()
		);
	}
});