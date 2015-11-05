var request = require('request');
var q = require('q');
var cheerio = require('cheerio');
var INFO = {};

document.addEventListener('DOMContentLoaded', function(e){
  var isRunning = false;
  var startButton = document.getElementById('start');
  var teamIdInput = document.getElementById('team-id');
  var participantIdInput = document.getElementById('participant-id');
  startButton.addEventListener('click', function(e){
    var team_id = parseInt(teamIdInput.value);
    var participant_id = parseInt(participantIdInput.value);
    if(isNaN(team_id) || isNaN(participant_id)){
      return alert('ERROR! Check your ids!');
    }
    if(!isRunning){
      getAll(team_id, participant_id).then(function(){
        console.log(INFO);
        fill();
      });
      startButton.innerText = 'Stop';

      // Start Interval
      // Populate with goals/recent donations

      isRunning = true;
    }else{
      // Clear Interval
      // Clear goals/recent donations
      isRunning = false;
      startButton.innerText = 'Start';
    }
  });

});

function fill(){
  var recentDonationBody = document.querySelector('.donations-body');
  INFO.recent_donations.recentDonations.forEach(function(donation){
    var donationHTML = '<div class="name">'+donation.name+'</div><div class="date">'+donation.date+'</div><div class="message">'+donation.message+'</div>';
    var donationElement = document.createElement('div');
    donationElement.classList.add('donation');
    donationElement.innerHTML = donationHTML;
    recentDonationBody.appendChild(donationElement);
  });
}

function getAll(team_id, participant_id){
  var a = getParticipantInfo(participant_id).then(function(res){
    INFO.participant_info = res;
  });
  var b = getParticipantGoal(participant_id).then(function(res){
    INFO.participant_goal = res;
  });
  var c = getRecentDonations(participant_id).then(function(res){
    INFO.recent_donations = res;
  });
  var d = getTeamInfo(team_id).then(function(res){
    INFO.team_info = res;
  });
  var e = getTeamGoal(team_id).then(function(res){
    INFO.team_goal = res;
  });
  return q.all([a, b, c, d, e]);
}

function getParticipantInfo(participant_id){
  var dfd = q.defer();
  var profileId = participant_id;
	var profileUrl = 'http://www.extra-life.org/index.cfm?fuseaction=donordrive.participant&participantID=' + profileId;
	var userInfoJson = { name : "", image : "", donateURL: "", team: "", teamURL: "", profileURL: profileUrl};
	request(profileUrl, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			var name, image, donateURL, team, teamURL;
			$('#participant-name').filter(function(){
				name = $(this).children('h1').text();
				userInfoJson.name = name;
			});
			$('.avatar').filter(function(){
				image = $(this).children('img.profile-img').attr('src');
				userInfoJson.image = image;
			});
			$('.btn-support-card').filter(function(){
				donateURL = $(this).attr('href');
				userInfoJson.donateURL = donateURL;
			});
			$('.link-team').filter(function(){
				var data = $(this);
				team = data.text();
				teamURL = 'http://www.extra-life.org/' + data.attr('href');
				userInfoJson.team = team;
				userInfoJson.teamURL = teamURL;
			});
      dfd.resolve(userInfoJson);
		}else{
			dfd.reject();
		}
	});
  return dfd.promise;
}

function getParticipantGoal(participant_id){
  var dfd = q.defer();
  var userGoalsJson = { goal : "", raised : ""};
	var setKey = function(key, value){
		userGoalsJson[key.toString()] = value;
	}
	var goalId = participant_id;
	var goalUrl = 'http://www.extra-life.org/index.cfm?fuseaction=widgets.ajaxWidgetCompileHTML&callback=jsonpCallback&language=en&participantid0=' + goalId + '&eventid0=525&type0=thermometer&currencyformat0=none&orientation0=horizontal&participantid1=' + goalId + '&eventid1=525&type1=participantImpact&headertext1=My+Impact&fundraiserlabel1=Total+Players';
	request(goalUrl, function(error, response){
		if(!error){
			var test = response.body.toString().split('jsonpCallback(')[1].split('}});')[0]
			var raised = test.split('dd-thermo-raised')[1].split('<')[0].split(',').join('');
			raised = parseInt(raised.split('$')[1].split('\\')[0]);
			setKey('raised', raised);
			var goal = test.split('Goal: </span>')[1].split('</strong')[0];
			goal = parseInt(goal.split('$')[1].split('\\')[0].split(',').join(''));
			setKey('goal', goal);
      dfd.resolve(userGoalsJson);
		}else{
			console.log('Error parsing userGoal URL');
      dfd.reject()
		}
	});
  return dfd.promise;
}

function getTeamInfo(team_id){
  var dfd = q.defer();
	var teamInfoId = team_id;
	var teamInfoUrl = 'http://www.extra-life.org/index.cfm?fuseaction=donordrive.teamParticipants&teamID=' + teamInfoId;
	var teamInfoJson = {name: "", teamURL: teamInfoUrl, teamImage: "", members:[]};
	request(teamInfoUrl, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			$('#team tbody tr').each(function(i, elem){
				var data = $(this).children('td').children('a');
				var memberObj ={name:"", raised: "", URL: "", pID: "", image: ""};
				memberObj.name = data.children('span').children('strong.block').text();
				memberObj.name = memberObj.name.replace(/(\r\n\t|\n|\r|\t)/gm,"");
				memberObj.raised = data.children('span').children('.gray').children('small:first-child').children('strong').text();
				var memberURL = data.attr('href');
				memberObj.URL = memberURL;
				memberObj.pID = memberURL.split('participantID=')[1];
				memberObj.image = 'http:' + data.children('span').children('.member-avatar').attr('src');
				teamInfoJson.members.push(memberObj);
			});
			$('#team-name').filter(function(){
				teamInfoJson.name = $(this).children('h1').text();
			})
			$('.profile-img').filter(function(){
				teamInfoJson.teamImage = 'http:' + $(this).attr('src');
			})
			dfd.resolve(teamInfoJson);
		}else{
			console.log('Error parsing teamInfo URL');
			dfd.reject();
		}
	});
  return dfd.promise;
}

function getTeamGoal(team_id){
  var dfd = q.defer();
  var teamGoalsJson = { goal : "", raised : ""};
	var setKey = function(key, value){
		teamGoalsJson[key.toString()] = value;
	}
	var teamId = team_id;
	var teamGoalUrl = 'http://www.extra-life.org/index.cfm?fuseaction=widgets.ajaxWidgetCompileHTML&callback=jsonpCallback&language=en&teamid0=' + teamId + '&eventid0=525&type0=thermometer&currencyformat0=none&orientation0=horizontal';
	request(teamGoalUrl, function(error, response){
		if(!error){
			var test = response.body.toString().split('jsonpCallback(')[1].split('}});')[0]
			var raised = test.split('dd-thermo-raised')[1].split('<')[0].split(',').join('');
			raised = parseInt(raised.split('$')[1].split('\\')[0]);
			// console.log(raised);
			setKey('raised', raised);
			var goal = test.split('Goal: </span>')[1].split('</strong')[0];
			goal = parseInt(goal.split('$')[1].split('\\')[0].split(',').join(''));
			setKey('goal', goal);
			dfd.resolve(teamGoalsJson)
		}else{
			console.log('Error parsing teamGoal URL');
			dfd.reject();
		}
	});
  return dfd.promise;
}

function getRecentDonations(participant_id){
  var dfd = q.defer();
  var userDonationsJson = {recentDonations:[]};
	var donationsId = participant_id;
	var donationsUrl = 'http://www.extra-life.org/index.cfm?fuseaction=donorDrive.participantDonations&participantID=' + donationsId;
	request(donationsUrl, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			$('.donor-detail').each(function(i, elem){
				var data = $(this);
				var donorObj ={};
				donorObj.name = data.children('strong').text();
				donorObj.name = donorObj.name.replace(/(\r\n\t|\n|\r|\t)/gm,"");
				donorObj.date = data.children('small').text();
				donorObj.date = donorObj.date.replace(/(\r\n\t|\n|\r|\t)/gm,"");
				donorObj.message = data.children('em').text();
				donorObj.message = donorObj.message.replace(/(\r\n\t|\n|\r|\t)/gm,"");
				userDonationsJson.recentDonations.push(donorObj);
			});
      dfd.resolve(userDonationsJson);
		}else{
			console.log('Error parsing recentDonations URL');
			dfd.reject();
		}
	});
  return dfd.promise;
}
