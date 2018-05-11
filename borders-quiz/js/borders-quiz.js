var container_id = "game-container"
var timer_id = "timer"
var timer_process_id = 0
var google_maps_api_key = "AIzaSyBg5esZrKJYIXrvFfgu1TIApJupbEPmcTk"
var borders_json_path = "/borders-quiz/json/borders.json"
var google_maps_zoom_levels_json_path = "/borders-quiz/json/google_maps_zoom_levels.json"

Array.prototype.contains = function(s) { return this.indexOf(s) >= 0 }

function parse_url() {
    var fields =  URI(window.location.href).fragment(true)
	var dict_names = []
    if (fields.countries) {
        dict_names = dict_names.concat("countries")
    }
	if (fields.usa_states) {
		dict_names = dict_names.concat("usa_states")
	}
	if (fields.india_states) {
		dict_names = dict_names.concat("india_states")
	}
    if (fields.canada_provinces) {
        dict_names = dict_names.concat("canada_provinces")
    }
    if (fields.mexico_states) {
        dict_names = dict_names.concat("mexico_states")
    }
    if (fields.china_provinces) {
        dict_names = dict_names.concat("china_provinces")
    }
    if (fields.japan_prefectures) {
        dict_names = dict_names.concat("japan_prefectures")
    }
    if (fields.australia_states) {
        dict_names = dict_names.concat("australia_states")
    }
    if (fields.south_korea_provinces) {
        dict_names = dict_names.concat("south_korea_provinces")
    }
    if (dict_names.length == 0) { // Default behavior when app visited.
        dict_names = ["countries"]
    }
	return dict_names
}

function territories() {
    var json = {}
    $.ajax({ url: borders_json_path, async: false, success: function (r) { json = r } })
    var territories_ = []
    var dict_names = parse_url()
    for (i = 0; i < dict_names.length; i++) {
    	territories_ = territories_.concat(Object.keys(json[dict_names[i]]))
    }
    return territories_
}

function neighbors(territory) {
    var json = {}
    $.ajax({ url: borders_json_path, async: false, success: function (r) { json = r } })
    for (var dict in json) {
    	if (json[dict][territory]) {
    		return json[dict][territory]
    	}
    }
    return []
}

function dict_name(territory) {
    var json = {}
    $.ajax({ url: borders_json_path, async: false, success: function (r) { json = r } })
    for (var dict in json) {
        if (json[dict][territory]) {
            return dict
        }
    }
    return ""
}

function google_maps_zoom_level(territory) {
    var json = {}
    $.ajax({ url: google_maps_zoom_levels_json_path, async: false, success: function (r) { json = r } })
    return (json[territory] ? json[territory] : 5)
}

function geocode(address) {
    var url = "https://maps.googleapis.com/maps/api/geocode/json"
    var json = {}
    $.ajax({ url: url, data: {"key": google_maps_api_key, "address": address}, async: false, success: function (r) { json = r }})
    return json
}

function coordinates(address) {
    if (dict_name(address) == 'japan_prefectures') {
        address += " Japan"
    }
    if (dict_name(address) == 'australia_states') {
        address += " Australia"
    }
    if (dict_name(address) == 'mexico_states') {
        address += " Mexico"
    }
    if (address == 'China_') {
        address = 'Nepal' // We're only interested in China's border with India.
    }
    if (address == 'Georgia') {
        address = 'Georgia country' // Not the U.S. state.
    }
    if (address == 'India') {
        address = 'Nepal' // For a clearer view of India's northern borders.
    }
    if (address == 'Italy') {
        address = 'San Marino' // For a clearer view of Italy's northern borders.
    }
    var coordinates = geocode(address).results[0].geometry.location
    return (coordinates.lat + ',' + coordinates.lng)
}

// Taken from http://web.archive.org/web/20120326084113/http://www.merlyn.demon.co.uk/js-shufl.htm
Array.prototype.swap = function(j, k) {
  var t = this[j] ; this[j] = this[k] ; this[k] = t
}
function random(x) {
  return Math.floor(x*(Math.random()%1)) 
}
function shuffle(l) {
    for (var j=l.length-1; j>0; j--) { 
        l.swap(j, random(j+1)) 
    }
    return l
}
function sample(l, k) {
    if (!l) {
        return []
    }
    for (var j=0; j < l.length; j++) {
        l.swap(j, random(l.length))
    }
    return l.slice(0,k)
}
function choice(l) {
    return l[random(l.length)]
}
////

function remove_neighbors_of_neighbor_from_bfs(territory, neighbor) {
    // China and Russia make the "graph distance" answer mechanic a little pointless.
    // If India and Poland are just three countries apart (India → China → Russia → Poland),
    // a question asking if they border each other is a bit too easy.
    if (['China', 'Russia'].contains(neighbor)) {
        return true
    }
    // China as bordering India poses the same problem.
    if (neighbor == 'China ') {
        return true
    }
    // East and West Europe are a bit too easy to discern between. So we block all roads through Germany and Italy.
    if (['Germany', 'Italy'].contains(neighbor)) {
        if (!['Denmark', 'Vatican City', 'San Marino'].contains(territory)) {
            return true
        }
    }
    // Morocco borders Spain through Ceuta. Algeria pretty obviously doesn't border Spain.
    if (neighbor == 'Morocco') {
        return true
    }
    // Turkey similarly borders a few obviously different regions, so let's block roads through it.
    if (neighbor == 'Turkey') {
        return true
    }
    // Likewise for Canada and Mexico when called from a U.S. state. Washington and Maine both border Canada,
    // but are on opposite sides of the country.
    if (['Canada ', 'Mexico '].contains(neighbor)) {
        if (territory != 'Alaska') {
            return true
        }
    }
    // Likewise for the U.S. when called from Canada. Alberta and New Brunswick are on opposite sides of the country.
    if (neighbor == 'United States (Continental)') {
        return true
    }
    // Brazil borders every country in South America except Ecuador and Chile!
    if (neighbor == 'Brazil') {
        return true
    }
    return false
}

function breadth_first_search(territory, depth) {
    var territory_distance_dict = { [territory]:0 }
    var bfs_queue = [territory]
    while (bfs_queue.length > 0) {
        var v = bfs_queue.shift()
        var neighbors_ = neighbors(v)
        for (var i = 0; i < neighbors_.length; i++) {
            var neighbor = neighbors_[i]
            if (territory_distance_dict[neighbor] == null) {
                territory_distance_dict[neighbor] = territory_distance_dict[v] + 1
                if (territory_distance_dict[neighbor] == depth + 1) {
                    return territory_distance_dict // Terminate BFS at given depth.
                }
                if (!remove_neighbors_of_neighbor_from_bfs(territory, neighbor)) {
                    bfs_queue.push(neighbor)
                }
            }
        }
    }
    return territory_distance_dict
}

function build_question(territory) {
    var num_wrong_answers = 3
    var wrong_answers = sample(neighbors(territory), num_wrong_answers)
    var possible_answers = []
    var bfs_depth = 2
    var territory_distance_dict = breadth_first_search(territory, bfs_depth)
    for (var t in territory_distance_dict) {
        if (territory_distance_dict[t] == bfs_depth) {
            possible_answers.push(t)
        }
    }
    // These are needed because otherwise there'd be no possible answers and we'd hit a game-breaking bug.
    //
    // This is also our only chance to include island countries, which we can't put in borders.json.
    if (['United Kingdom', 'Ireland'].contains(territory)) {
        possible_answers = ['France', 'Netherlands', 'Belgium']
    }
    else if (['Dominican Republic', 'Haiti'].contains(territory)) {
        possible_answers = ['Cuba', 'Jamaica']
    }
    else if (['Ehime', 'Tokushima'].contains(territory)) {
        possible_answers = ['Okinawa', 'Hokkaido']
    }
    // These are just to play with the player by giving them less obvious answers.
    else if (['Finland', 'Sweden', 'Norway'].contains(territory)) {
        possible_answers = ['Denmark', 'Iceland']
    }
    else if (['North Korea', 'South Korea'].contains(territory)) {
        possible_answers = ['Japan']
    }
    else if (['Mongolia'].contains(territory)) {
        possible_answers = ['Kazakhstan']
    }
    else if (['China'].contains(territory)) {
        possible_answers = possible_answers.concat(['Taiwan'])
    }
    else if (['Vietnam'].contains(territory)) {
        possible_answers = possible_answers.concat(['Philippines'])
    }
    else if (['San Marino'].contains(territory)) {
        possible_answers = ['Vatican City']
    }
    else if (['Vatican City'].contains(territory)) {
        possible_answers = ['San Marino']
    }
    else if (['Malaysia', 'Indonesia'].contains(territory)) {
        possible_answers = possible_answers.concat(['Singapore', 'Philippines'])
    }
    else if (['New South Wales', 'Victoria', 'South Australia'].contains(territory)) {
        possible_answers = possible_answers.concat(['Tasmania', 'New Zealand'])
    }
    else if (['Italy', 'Libya', 'Tunisia'].contains(territory)) {
        possible_answers = possible_answers.concat(['Malta'])
    }
    else if (['Mauritania', 'Senegal', 'The Gambia', 'Guinea-Bissau', 'Guinea'].contains(territory)) {
        possible_answers = possible_answers.concat(['Cape Verde'])
    }
    else if (['Nigeria', 'Cameroon', 'Equatorial Guinea', 'Gabon'].contains(territory)) {
        possible_answers = possible_answers.concat(['Sao Tome and Principe'])
    }
    else if (['Mozambique', 'Tanzania'].contains(territory)) {
        possible_answers = possible_answers.concat(['Madagascar', 'Comoros', 'Seychelles', 'Mauritius'])
    }
    else if (['Saudi Arabia', 'Qatar', 'United Arab Emirates'].contains(territory)) {
        possible_answers = possible_answers.concat(['Bahrain'])
    }
    else if (['Israel', 'Lebanon', 'Syria', 'Turkey'].contains(territory)) {
        possible_answers = possible_answers.concat(['Cyprus'])
    }
    else if (['India', 'Bangladesh'].contains(territory)) {
        possible_answers = possible_answers.concat(['Sri Lanka', 'Maldives'])
    }
    else if (['Venezuela'].contains(territory)) {
        possible_answers = possible_answers.concat(['Trinidad and Tobago'])
    }
    ////
    var answer = choice(possible_answers)
    return {territory: territory, answer: answer, wrong_answers: wrong_answers, chosen:""}
}

function prepend_the(territory, start_of_sentence=false) {
    var the = (start_of_sentence ? "The " : "the ")
    var territories_to_prepend = ['Australian Capital Territory', 'Northern Territory', 'Maldives', 'Seychelles', 'Philippines', 'Red Sea', 'Western Sahara', 'Baltic Sea', 'Caspian Sea', 'Black Sea', 'United States (Continental)', 'Northwest Territories', 'Yukon Territory', 'United Kingdom', 'United States', 'Netherlands', 'Central African Republic', 'United Arab Emirates', 'Democratic Republic of the Congo', 'Dominican Republic', 'Mediterranean Sea', 'Mississippi River', 'Republic of the Congo']
    return (territories_to_prepend.contains(territory) ? the : "")
}

function pretty_print(territory, start_of_sentence=false) {
    var the = prepend_the(territory, start_of_sentence)
    return (the + territory.replace(/_/g,'').replace(/\s/g,'&nbsp;'))
}

function neighbors_to_sentence(territory) {
    var s = ""
    var neighbors_ = neighbors(territory)
    if (neighbors_.length == 0) {
        return " nothing!"
    }
    if (neighbors_.length == 1) {
        s += " only "
        s += pretty_print(neighbors_[0])
    }
    else if (neighbors_.length == 2) {
        s += (pretty_print(neighbors_[0]) + " and " + pretty_print(neighbors_[1]))
    }
    else {
        for (i = 0; i < neighbors_.length - 1; i++) {
            s += pretty_print(neighbors_[i])
            s += ", "
        }
        s += "and "
        s += pretty_print(neighbors_[neighbors_.length - 1])
    }
    return (s + ".")
}

// Only for testing.
function test_map(t) {
    embed_map(build_question(t), {correct:0,wrong:0})
}
function test_question(t) {
    test_map(t)
    function next_question_button() {
        var next_button = document.getElementById(container_id).contentWindow.document.getElementsByName("next")[0]
        if (document.getElementById(container_id).contentWindow.document.getElementsByName("next").length == 0) {
            window.requestAnimationFrame(next_question_button);
        }
        next_button.click()
    }
    next_question_button()
}
// Above code can be freely removed.

// Timer code.
function format_time(raw_date) {
    function prepend_zero(time) {
        return (time < 10 ? "0" + time : time)
    }
    var total_seconds = raw_date/1000
    var hours = prepend_zero(Math.floor(total_seconds/60/60))
    var minutes = prepend_zero(Math.floor((total_seconds/60) % 60))
    var seconds = prepend_zero(Math.floor(total_seconds % 60))
    var time = minutes + ":" + seconds
    return (hours > 0 ? hours + ":" + time : time)
}
function timer(start_time) {
    var time_elapsed = format_time(Date.now() - start_time)
    var timer_span = document.getElementById(container_id).contentWindow.document.getElementById("timer")
    if (timer_span) {
        timer_span.innerHTML = time_elapsed
    }
}
function start_timer(start_time=Date.now()) {
    clearInterval(timer_process_id)
    timer_process_id = setInterval(function() { timer(start_time) }, 1000)
    return start_time
}
////

function embed(src) {     
    document.getElementById(container_id).srcdoc=src
    document.getElementById(container_id).style = "border: 2px solid black"
}

function embed_map(question_info, score, start_time) {
    question_info.chosen = question_info.chosen.replace(/\'/g,'&#39;')
    question_info.answer = question_info.answer.replace(/\'/g,'&#39;')
    var territory = (question_info.chosen == question_info.answer ? question_info.chosen : question_info.territory)
    var zoom = google_maps_zoom_level(territory)
    if (dict_name(territory) == 'japan_prefectures') {
        zoom = 7
    }
    else if (dict_name(territory) == 'south_korea_provinces') {
        zoom = 7
    }
    var coordinates_ = coordinates(territory)
    var url = URI("https://www.google.com/maps/embed/v1/view").search({"key": google_maps_api_key, "zoom": zoom, "center": coordinates_}).toString()

    // Hacky way of styling on mobile.
    var map_height = ($(document).width() > 760 ? 350 : 200)
    var map_width = "80%"
    var map = "<iframe width='"
    map += map_width
    map += "' height='"
    map += map_height
    map += "' frameborder='0' src='"
    map += url
    map += "'></iframe>"

    function top_message() {
        var success = " does not border "
        var failure = " does border "
        if (question_info.chosen == question_info.answer) {
            return ("Correct! " + pretty_print(question_info.chosen, true) + success + pretty_print(question_info.territory) + "!")
        }
        else {
            return ("Sorry! " + pretty_print(question_info.territory, true) + failure + pretty_print(question_info.chosen) + "!")
        }
    }

    content  = "<div style='position:relative;min-height:480px;'>"
    content += "<center>"
    content += "<p style='font-family:Helvetica'>"
    content += top_message()
    content += "</p>"
    content += map
    content += "<p style='font-family:Helvetica'>"
    content += pretty_print(territory, true)
    content += " borders "
    content += neighbors_to_sentence(territory)
    content += "</p>"
    content += "<button name='next'></button>"
    content += "</center>"
    content += bottom_right_message_map(territory)
    content += "</div>"
    embed(content)

    // Taken from https://swizec.com/blog/how-to-properly-wait-for-dom-elements-to-show-up-in-modern-browsers/swizec/6663
    function next_question_button() {
        if (document.getElementById(container_id).contentWindow.document.getElementsByName("next").length == 0) {
            window.requestAnimationFrame(next_question_button);
        }
        else {
            var next_button = document.getElementById(container_id).contentWindow.document.getElementsByName("next")[0]
            if (question_info.chosen == question_info.answer) {
                score.correct += 1
                next_button.onclick = function() { return next_question(null, score, start_time) }
                next_button.innerHTML = "Next"
            }
            else {
                score.wrong += 1
                next_button.onclick = function() { return next_question(question_info, score, start_time) }
                next_button.innerHTML = "Try Again"
            }
    	}
    }
    next_question_button()
}

function bottom_right_message_map(territory) {
    question = "" 
    question += "<div style='position:absolute;right:5%;bottom:0;font-size:15px;font-family:Helvetica'>"
    question += "<p style='float:right'>"
    if (dict_name(territory) == 'mexico_states') {
        question += "(Clearer map <a href='http://ontheworldmap.com/mexico/mexico-states-map.jpg' target='_blank'>here</a>.)"
    }
    else if (dict_name(territory) == 'india_states') {
        question += "(Clearer map <a href='https://www.mapsofindia.com/maps/india/india-large-color-map.jpg' target='_blank'>here</a>.)"
    }
    else if (dict_name(territory) == 'china_provinces') {
        question += "(Clearer map <a href='http://www.sacu.org/maps/provmap.png' target='_blank'>here</a>.)"
    }
    else if (dict_name(territory) == 'japan_prefectures') {
        question += "(Clearer map <a href='https://upload.wikimedia.org/wikipedia/commons/5/5a/Regions_and_Prefectures_of_Japan.png' target='_blank'>here</a>.)"
    }
    else if (dict_name(territory) == 'south_korea_provinces') {
        question += "(Clearer map <a href='https://en.wikipedia.org/wiki/Provinces_of_Korea#/media/File:Provinces_of_South_Korea_(numbered_map).png' target='_blank'>here</a>.)"
    }
    question += "</p>"
    question += "</div>"
    return question 
}

function bottom_right_message(score, start_time) {
    question = "" 
    question += "<div style='position:absolute;right:5%;bottom:0;font-size:15px;font-family:Helvetica'>"
    question += "<p style='float:right'>"
    question += "<i>"
    question += "Correct: "
    question += score.correct
    question += "&nbsp;&nbsp;Wrong: "
    question += score.wrong
    question += "</i>"
    question += "<br><span id='timer' style='float:right'>"
    question += format_time(Date.now() - start_time)
    question += "</span>"
    question += "</p>"
    question += "</div>"
    function time() {
        if (document.getElementById(container_id).contentWindow.document.getElementById("timer") == null) {
            window.requestAnimationFrame(time);
        }
        else {
            start_timer(start_time)
        }
    }
    time()
    return question 
}

function embed_question(question_info, score, start_time) {
    var choices = shuffle(question_info.wrong_answers.concat(question_info.answer))
    question  = "<div style='position:relative;min-height:490px;'>"
    question += "<div style='padding-left:15%;padding-top:17%;font-size:20px;font-family:Helvetica'>"
    question += "<p>Which of these does not border "
    question += pretty_print(question_info.territory)
    question += "?</p>"
    question += "<form>"
    for (i = 0; i < choices.length; i++) {
        var choice = choices[i]
        var letter = String.fromCharCode(i + 65)
        question += "<input type='radio' id='"
        question += choice
        question += "' value='"
        question += choice
        question += "' name='choice'><label for='"
        question += choice
        question += "'>&emsp;"
        question += letter
        question += ". "
        question += pretty_print(choice, true)
        question += "</label><br>"
    }
    question += "</form>"
    question += "</div>"
    question += bottom_right_message(score, start_time)
    question += "</div>"

    embed(question)

    // Taken from https://swizec.com/blog/how-to-properly-wait-for-dom-elements-to-show-up-in-modern-browsers/swizec/6663
    function detect_player_choice() {
        if (document.getElementById(container_id).contentWindow.document.getElementsByName("choice").length == 0) {
            window.requestAnimationFrame(detect_player_choice);
        }
        else {
            var choices = document.getElementById(container_id).contentWindow.document.getElementsByName("choice")
            for (i = 0; i < choices.length; i++) {
                choices[i].onclick = function() {
                    question_info.chosen = this.id
                    embed_map(question_info, score, start_time)
                }
            }
        }
    }
    detect_player_choice()
}

function next_question(question_info, score, start_time) {
    if (question_info) {
        embed_question(question_info, score, start_time)
    }
    else {
        embed_question(build_question(choice(territories())), score, start_time)
    }
}