var request = require('request');
var q = require('q');
var cheerio = require('cheerio');
var shell = require('shell');
var clipboard = require('clipboard');
var notifier = require('node-notifier');
var extralifeapi = require('extra-life-api');
var path = require('path');
var INFO = {};
var recentDonationsCache;
var notificationsQueue = [];
var CHECK_INTERVAL = 10000;
var NOTIFICATIONS_ENABLED = true;
var ipcRenderer = require('electron').ipcRenderer;

document.addEventListener('DOMContentLoaded', function(e){
  var isRunning = false;
  var startButton = document.getElementById('start');
  var teamIdInput = document.getElementById('team-id');
  var participantIdInput = document.getElementById('participant-id');
  var interval;
  var notificationCheckbox = document.getElementById('notifications');
  notificationCheckbox.addEventListener('change', function(e){
    NOTIFICATIONS_ENABLED = notificationCheckbox.checked;
  });
  startButton.addEventListener('click', function(e){
    var participant_id = parseInt(participantIdInput.value);
    if(isNaN(participant_id)){
      return alert('ERROR! Check your id!');
    }
    if(!isRunning){
      getAll(participant_id).then(function(){
        console.log(INFO);
        recentDonationsCache = INFO.recent_donations.recentDonations;
        var participantAvatar = document.querySelector('.participant-info .avatar');
        var participantName = document.querySelector('.participant-info .name');
        var participantLink = document.querySelector('.participant-info .copy-link');
        var participantOpenLink = document.querySelector('.participant-info .open-link');
        participantOpenLink.setAttribute('data-link', INFO.participant_info.donateURL);
        participantName.innerText = INFO.participant_info.displayName;
        participantAvatar.style.backgroundImage = "url('"+INFO.participant_info.avatarImageURL+"')";
        participantOpenLink.classList.remove('hidden');
        participantLink.classList.remove('hidden');
        var teamAvatar = document.querySelector('.team-info .avatar');
        var teamName = document.querySelector('.team-info .name');
        if(INFO.team_info){
          var teamLink = document.querySelector('.team-info .copy-link');
          var teamOpenLink = document.querySelector('.team-info .open-link');
          teamOpenLink.setAttribute('data-link', INFO.team_info.teamURL);
          teamOpenLink.classList.remove('hidden');
          teamLink.classList.remove('hidden');
          teamName.innerText = INFO.team_info.name;
          teamAvatar.style.backgroundImage = "url('"+INFO.team_info.avatarImageURL+"')";
        }else{
          document.querySelector('.team-info').classList.add('hidden');
        }
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
        getAll(participant_id).then(function(){
          console.log(INFO);
          fill();
        });
      }, CHECK_INTERVAL);
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
  var q = {
    avatarImageURL: "//assets.donordrive.com/extralife/images/$avatars$/constituent_0680BAE6-C292-13D6-0A2E3AA090527D06.jpg",
    createdOn: "2016-10-30T12:41:27-0400",
    donationAmount: 15,
    donorName: "TEST TESTERSON",
    message: "yo dank #memes yo"
  };
  var w = {
    avatarImageURL: "//assets.donordrive.com/extralife/images/$avatars$/constituent_0680BAE6-C292-13D6-0A2E3AA090527D06.jpg",
    createdOn: "2016-10-30T12:41:27-0400",
    donationAmount: 20,
    donorName: "Lanzo",
    message: "heres money"
  };
  // debugger
  INFO.recent_donations.push(q);
  INFO.recent_donations.push(w);
  INFO.participant_goal.raised += q.donationAmount;
  INFO.participant_goal.raised += w.donationAmount;
  if(INFO.team_goal){
    INFO.team_goal.raised += q.donationAmount;
    INFO.team_goal.raised += w.donationAmount;
  }

  console.log(INFO.recent_donations);

  INFO.recent_donations.forEach(function(donation){
    var date = new Date(donation.createdOn).toLocaleDateString();
    var message = !!donation.message ? donation.message : 'No Message';
    var donationHTML = '<img class="avatar" src="http:'+donation.avatarImageURL+'"><div class="dono"><div class="name">'+donation.donorName+'</div><div class="date">'+date+'</div><div class="message">'+message+'</div></div>';
    var donationElement = document.createElement('div');
    donationElement.classList.add('donation');
    donationElement.innerHTML = donationHTML;
    recentDonationBody.appendChild(donationElement);
  });

  if(INFO.team_info){
    document.querySelector('.team-goal').querySelector('.goal-amount').innerHTML = INFO.team_goal.goal;
    document.querySelector('.team-goal').querySelector('.goal-current').innerHTML = INFO.team_goal.raised;
    document.querySelector('.team-goal .goal-bar-inner').style.height = Math.round((INFO.team_goal.raised/INFO.team_goal.goal) * 100) + 'px';
  }

  document.querySelector('.participant-goal').querySelector('.goal-amount').innerHTML = INFO.participant_goal.goal;
  document.querySelector('.participant-goal').querySelector('.goal-current').innerHTML = INFO.participant_goal.raised;
  document.querySelector('.participant-goal .goal-bar-inner').style.height = Math.round((INFO.participant_goal.raised/INFO.participant_goal.goal) * 100) + 'px';

  compareDonations();
}

function compareDonations(){
  var newRecent = INFO.recent_donations;
  var oldRecent = recentDonationsCache || [];
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
  if(!NOTIFICATIONS_ENABLED){
    return;
  }
  if(notificationsQueue.length > 0){
    notify(notificationsQueue[0]);
    checkSound(notificationsQueue[0].message);
    notificationsQueue.splice(0, 1);
  }
}, 10000);

function checkSound(message){
  if(message.includes('#cena') || message.includes('#CENA')){
    playSound('cena');
  }else if(message.includes('#memes') || message.includes('#MEMES')){
    playSound('memes');
  }else{
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
  console.log(donation.donorName+' donated $'+donation.donationAmount+' through '+INFO.participant_info.displayName+'! :pogchamp: "'+donation.message+'"');
  // notifier.notify({
  //   title: 'New Donation from '+donation.donorName,
  //   message: donation.message,
  //   icon: path.join(__dirname, 'images', 'controller_blue.png'), // absolute path (not balloons)
  //   sound: false, // Only Notification Center or Windows Toasters
  //   wait: false // wait with callback until user action is taken on notification
  // }, function (err, response) {
  //   if(err){
  //     dfd.reject();
  //   }else{
  //     dfd.resolve();
  //   }
  //   console.log('err & res', err, response);
  // });

  ipcRenderer.sendSync('notify', donation);

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

function getAll(participant_id){
  var a = getParticipantInfo(participant_id).then(function(res){
    var dfd = q.defer();
    INFO.participant_info = res;
    INFO.participant_goal = {
      goal: res.fundraisingGoal,
      raised: res.totalRaisedAmount
    };
    dfd.resolve(res);
    return dfd.promise;
  }).then(function(partInfo){
    var dfd = q.defer();
    if(partInfo.teamID){
      getTeamInfo(partInfo.teamID).then(function(res){
        INFO.team_info = res;
        INFO.team_goal = {
          goal: res.fundraisingGoal,
          raised: res.totalRaisedAmount
        }
        dfd.resolve();
      });
    }else{
      dfd.resolve();
    }
    return dfd.promise;
  });
  var c = getRecentDonations(participant_id).then(function(res){
    INFO.recent_donations = res;
  });
  return q.all([a, c]);
}

function getParticipantInfo(participant_id){
  var dfd = q.defer();
  extralifeapi.getUserInfo( participant_id, function( data ){
    dfd.resolve(data);
  });
  return dfd.promise;
}

function getParticipantGoal(participant_id){
  var dfd = q.defer();
  return dfd.promise;
}

function getTeamInfo(team_id){
  var dfd = q.defer();
  extralifeapi.getTeamInfo( team_id, function( data ){
    dfd.resolve(data);
  });
  return dfd.promise;
}

function getRecentDonations(participant_id){
  var dfd = q.defer();
  extralifeapi.getRecentDonations( participant_id, function( data ){
    dfd.resolve(data);
  });
  return dfd.promise;
}
