var request = require('request');
var q = require('q');
var cheerio = require('cheerio');
var shell = require('shell');
var clipboard = require('clipboard');
var notifier = require('node-notifier');
var path = require('path');
var INFO = {};
var recentDonationsCache;
var notificationsQueue = [];

document.addEventListener('DOMContentLoaded', function(e){
  var isRunning = false;
  var startButton = document.getElementById('start');
  var teamIdInput = document.getElementById('team-id');
  var participantIdInput = document.getElementById('participant-id');
  var interval;
  startButton.addEventListener('click', function(e){
    var team_id = parseInt(teamIdInput.value);
    var participant_id = parseInt(participantIdInput.value);
    if(isNaN(team_id) || isNaN(participant_id)){
      return alert('ERROR! Check your ids!');
    }
    if(!isRunning){
      getAll(team_id, participant_id).then(function(){
        console.log(INFO);
        recentDonationsCache = INFO.recent_donations.recentDonations;
        var participantAvatar = document.querySelector('.participant-info .avatar');
        var participantName = document.querySelector('.participant-info .name');
        var participantLink = document.querySelector('.participant-info .copy-link');
        var participantOpenLink = document.querySelector('.participant-info .open-link');
        participantOpenLink.setAttribute('data-link', INFO.participant_info.donateURL);
        participantName.innerText = INFO.participant_info.name;
        participantAvatar.style.backgroundImage = "url('http:"+INFO.participant_info.image+"')";
        participantOpenLink.classList.remove('hidden');
        participantLink.classList.remove('hidden');
        var teamAvatar = document.querySelector('.team-info .avatar');
        var teamName = document.querySelector('.team-info .name');
        var teamLink = document.querySelector('.team-info .copy-link');
        var teamOpenLink = document.querySelector('.team-info .open-link');
        teamOpenLink.setAttribute('data-link', INFO.team_info.teamURL);
        teamOpenLink.classList.remove('hidden');
        teamLink.classList.remove('hidden');
        teamName.innerText = INFO.team_info.name;
        teamAvatar.style.backgroundImage = "url('"+INFO.team_info.teamImage+"')";
        participantLink.addEventListener('click', function(e){
          clipboard.writeText(INFO.participant_info.donateURL);
        });
        teamLink.addEventListener('click', function(e){
          clipboard.writeText(INFO.team_info.teamURL);
        });
        var links = document.querySelectorAll('[data-link]');
        for(var i=0;i<links.length;i++){
          links[i].addEventListener('click', function(e){
            shell.openExternal(e.target.getAttribute('data-link'));
          });
        }
        fill();
      });
      startButton.innerText = 'Stop';
      interval = setInterval(function(){
        getAll(team_id, participant_id).then(function(){
          console.log(INFO);
          fill();
        });
      }, 10000);
      isRunning = true;
    }else{
      clearInterval(interval);
      document.querySelector('.donations-body').innerHTML = '';
      isRunning = false;
      startButton.innerText = 'Start';
    }
  });

  var links = document.querySelectorAll('[data-link]');
  for(var i=0;i<links.length;i++){
    links[i].addEventListener('click', function(e){
      shell.openExternal(e.target.getAttribute('data-link'));
    });
  }

});

function fill(){
  var recentDonationBody = document.querySelector('.donations-body');
  recentDonationBody.innerHTML = '';
  INFO.recent_donations.recentDonations.forEach(function(donation){
    var donationHTML = '<div class="name">'+donation.name+'</div><div class="date">'+donation.date+'</div><div class="message">'+donation.message+'</div>';
    var donationElement = document.createElement('div');
    donationElement.classList.add('donation');
    donationElement.innerHTML = donationHTML;
    recentDonationBody.appendChild(donationElement);
  });

  compareDonations();
}

function compareDonations(){
  var newRecent = INFO.recent_donations.recentDonations;
  var oldRecent = recentDonationsCache;
  var newDonations = [];
  for(var i=0;i<newRecent.length;i++){
    if(!containsObject(newRecent[i], oldRecent)){
      newDonations.push(newRecent[i]);
    }
  }
  notificationsQueue = notificationsQueue.concat(newDonations);
  recentDonationsCache = newRecent;
}

setInterval(function(){
  if(notificationsQueue.length > 0){
    notify(notificationsQueue[0]);
    checkSound(notificationsQueue[0].message);
    notificationsQueue.splice(0, 1);
  }
}, 10000);

function checkSound(message){
  if(message.includes('#cena') || message.includes('#CENA')){
    playSound('cena');
  }
  if(message.includes('#memes') || message.includes('#MEMES')){
    playSound('memes');
  }
  if(message.includes('#moneyinthebank') || message.includes('#MONEYINTHEBANK') || message.includes('#MoneyInTheBank')){
    playSound('moneyinthebank');
  }
}

function playSound(sound){
  var player = document.getElementById('player');
  var playerSrc = path.join(__dirname, 'audio', sound+'.mp3');
  player.src = playerSrc;
  player.load();
  player.play();
}

function notify(donation){
  var dfd = q.defer();
  notifier.notify({
    title: 'New Donation from '+donation.name,
    message: donation.message,
    icon: path.join(__dirname, 'images', 'tfn.jpg'), // absolute path (not balloons)
    sound: true, // Only Notification Center or Windows Toasters
    wait: false // wait with callback until user action is taken on notification
  }, function (err, response) {
    if(err){
      dfd.reject();
    }else{
      dfd.resolve();
    }
    console.log('err & res', err, response);
  });
  return dfd.promise;
}

function containsObject(obj, list) {
  var i;
  for (i = 0; i < list.length; i++) {
    if (isEquivalent(list[i], obj)) {
      return true;
    }
  }
  return false;
}

function isEquivalent(a, b) {
  var aProps = Object.getOwnPropertyNames(a);
  var bProps = Object.getOwnPropertyNames(b);
  if (aProps.length != bProps.length) {
    return false;
  }
  for (var i = 0; i < aProps.length; i++) {
    var propName = aProps[i];
    if (a[propName] !== b[propName]) {
      return false;
    }
  }
  return true;
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
