/*

@author: ajddev
@name: destrict
@description: uncensorable social media

script.js

*/

/*

TO-DO LIST
----------

Login:
  - create new account (Ed25519 public/private key generator, testnet funds with friendbot)

Feed:
  - posts directed at another user
  - on hover profile images, popup of profile preview
  - on hover stats, popup of likes or reposts (show users)
  - only count 1 like/repost per account
  - new posts load without Base64 decoding (need refresh)

Friends:
  - on hover profile images, popup of profile preview

Profile:
  - followers count?
  - profile page joined time format (e.g. "Joined March 2019")
  - camera + add picture icon on hover profile pic
  - calender icon next to Join Date
  - QR code profile side by side or on hover opaque on profile image (currently displays with public key onclick)

Other:
  - countdown to testnet reset
  - backup destrict (save testnet state for import after reset?)
  - notifications
  - option to load new posts as they come or show new posts option at top of timeline
  - light/dark mode


KNOWN BUGS
----------
    (many due to improper asynchronous code)
  - Likes sometimes appear undefined
  - Posts sometimes are not decoded from Base64
  - Upon mutual friendship, build is inhibited/broken

  
NOTES
-----
  - Maximum post length is one transaction (100 operations, manage_data, key = 'post')
      50 operations deleting previous data entry
      64 bytes per key value
      50 * 64 bytes (after converting to Base64)

*/

"use strict";

// consts
const base_url = "https://horizon-testnet.stellar.org/accounts/";
const server = new StellarSdk.Server("https://horizon-testnet.stellar.org");
const feed = document.getElementById("feed-list");
const profileFeedList = document.getElementById("profile-feed-list");
const friends_button = document.getElementById("friends");
const siteMessage = document.getElementById("message");
const esArray = [];

// elements
const main = document.querySelector(".main");
const privateKey = document.getElementById("private");
const privateSubmit = document.getElementById("private-submit");
const tabs = document.querySelector(".tabs");
const container = document.querySelector(".container");
const theFeed = document.querySelector(".feed");
const profileFeed = document.querySelector(".feed");
const theFriends = document.querySelector(".friends");
const theProfile = document.querySelector(".profile");
const friendsListvar = document.getElementById("friends-list");
const feedIcon = document.querySelector(".fa-code");
const friendsIcon = document.querySelector(".fa-users");
const profileIcon = document.querySelector(".fa-user-circle");
const whatsNew = document.querySelector('a[href="#whats-new"]');
const whatsNewInput = document.getElementById("whats-new-input");

// profile elements
const joinedDate = document.getElementById("joinedDate");
const userLocation = document.getElementById("location");
const website = document.getElementById("website");
const followers = document.querySelector(".followers");
const following = document.querySelector(".following");

// lets
let self = "GA32D6LAEPPZ5FT2YSJWMSXETQHFSJBEQQ75UJDRMQK2ZVGANYK6AVHQ";
let selfSecret = "SDOVCBD563WFJTYGR43WAT6JMJCUJ4L6EQI2XZE3WE47IB5ZBMKXCNSG";

let dataOperationsArray = [];
let loaded = false;
let friendsLoaded = false;

const userObj = {
  bannerImage: "",
  bio: "",
  friends: [],
  joinedDate: "",
  latestOperationID: "",
  userLocation: "",
  profileImage:
    "https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png",
  username: "",
};

const post = {};
const users = {}; // filled with userObj
const timeline = {};

privateSubmit.addEventListener("click", function (event) {
  event.preventDefault();
  selfSecret = privateKey.value;
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  self = sourceKeypair.publicKey();
  main.classList.toggle("hidden");
  tabs.classList.toggle("hidden");
  container.classList.toggle("hidden");
  asyncCall(self); // destrict begins here
});

// find latest operation of self and the timestamp so if statement
function getLatestOperation(user) {
  return new Promise((resolve) => {
    resolve(
      $.ajax({
        url: `${base_url}${user}/operations?order=desc`,
        dataType: "json",
        // error: function ( data ) { },
        success: function (data) {
          users[`${user}`] = {
            ...userObj,
          };
          users[`${user}`].latestOperationID = data._embedded.records[0].id;
        },
      })
    );
  });
}

async function asyncCall(user) {
  const result = await getLatestOperation(user);
  esArray[`${user}`] = new EventSource(base_url + user + "/operations");
  initES(esArray[`${user}`], user);
}

const clikes = async (operation) => {
  const response = await fetch(
    `https://api.stellar.expert/explorer/testnet/payments?memo=${operation}`
  );
  const data = await response.json();
  return data._embedded.records.length;
};

class DataOperation {
  constructor(
    timestamp,
    links_self_href,
    links_transaction_href,
    links_effects_href,
    links_succeeds_href,
    links_precedes_href,
    id,
    paging_token,
    transaction_successful,
    source_account,
    type,
    type_i,
    created_at,
    transaction_hash,
    name,
    value,
    starting_balance,
    funder,
    account
  ) {
    this.timestamp = timestamp;
    this.links_self_href = links_self_href;
    this.links_transaction_href = links_transaction_href;
    this.links_effects_href = links_effects_href;
    this.links_succeeds_href = links_succeeds_href;
    this.links_precedes_href = links_precedes_href;
    this.id = id;
    this.paging_token = paging_token;
    this.transaction_successful = transaction_successful;
    this.source_account = source_account;
    this.type = type;
    this.type_i = type_i;
    this.created_at = created_at;
    this.transaction_hash = transaction_hash;
    this.name = name;
    this.value = value;
    this.starting_balance = starting_balance;
    this.funder = funder;
    this.account = account;
  }
  async initialize() {
    const response = await fetch(
      `https://api.stellar.expert/explorer/testnet/payments?memo=${this.id}`
    );
    const data = await response.json();
    this.likes = data._embedded.records.length;
    try {
      const likePosts = document.querySelectorAll(`.likes-${this.id}`);

      likePosts.forEach((post) => {
        post.innerHTML = `<a href='javascript:likePost(${this.id})'><i class="fa fa-heart" aria-hidden="true"> ${this.likes}</i></a>`;
      });
    } catch (e) {
      //
    }
  }
  getLikes() {
    return this.likes.data;
  }
}

function addDataOperation(result) {
  const dataOp = new DataOperation(
    new Date(result.created_at).valueOf(),
    result._links.self.href,
    result._links.transaction.href,
    result._links.effects.href,
    result._links.succeeds.href,
    result._links.precedes.href,
    result.id,
    result.paging_token,
    result.transaction_successful,
    result.source_account,
    result.type,
    result.type_i,
    result.created_at,
    result.transaction_hash,
    result.name,
    result.value,
    null,
    null,
    null
  );
  if (result.name === "post") {
    dataOp.initialize();
  }
  dataOperationsArray.push(dataOp);
}

function initES(es, user) {
  // EventSource
  es.onmessage = function (message) {
    let result = message.data ? JSON.parse(message.data) : message;

    if (result.type === "manage_data" && result.value !== "") {
      addDataOperation(result);

      if (result.source_account === user) {
        if (result.name === "add friend" || result.name === "remove friend") {
          accountExists(Base64.decode(result.value), user, result.name);
        }
      }
      if (result.name === "post") {
        //console.log(result.id);
      }
      if (result.name === "username") {
        users[`${user}`].username = Base64.decode(Base64.decode(result.value));
      }
      if (result.name === "profile image") {
        users[`${user}`].profileImage = Base64.decode(
          Base64.decode(result.value)
        );
      }
      if (result.name === "banner image") {
        users[`${user}`].bannerImage = Base64.decode(
          Base64.decode(result.value)
        );
      }
      if (result.name === "bio") {
        users[`${user}`].bio = Base64.decode(Base64.decode(result.value));
      }
      if (result.name === "location") {
        users[`${user}`].userLocation = Base64.decode(
          Base64.decode(result.value)
        );
      }
    }

    if (result.type === "payment") {
      //
    }

    if (result.type === "create_account") {
      const dataOp = new DataOperation(
        new Date(result.created_at).valueOf(),
        result._links.self.href,
        result._links.transaction.href,
        result._links.effects.href,
        result._links.succeeds.href,
        result._links.precedes.href,
        result.id,
        result.paging_token,
        result.transaction_successful,
        result.source_account,
        result.type,
        result.type_i,
        result.created_at,
        result.transaction_hash,
        null,
        null,
        result.starting_balance,
        result.funder,
        result.account
      );
      dataOperationsArray.push(dataOp);

      users[`${user}`].joinedDate = result.created_at;
    }

    // reached the latest post of self
    if (result.id === users[`${user}`].latestOperationID) {
      if (loaded === false) {
        loaded = true;
        getFriendsPosts();
      } else {
        if (user === users[`${self}`].friends.at(-1)) {
          build();
        }
      }
    }

    if (friendsLoaded === true) {
      if (result.value) {
        const html = buildFeedItem(
          dataOperationsArray[dataOperationsArray.length - 1]
        );
        feed.insertAdjacentHTML("afterbegin", html);
        profileFeedList.insertAdjacentHTML("afterbegin", html);
      }
    }
  };
  es.onerror = function (error) {
    //alert("An error occurred!");
  };
}

async function accountExists(account, currentUser, addOrRemove) {
  if (!StellarSdk.StrKey.isValidEd25519PublicKey(account)) {
    dataOperationsArray = dataOperationsArray.filter(
      (a) => a.value !== Base64.encode(account)
    );
    return;
  }
  if (addOrRemove === "add friend") {
    users[currentUser].friends.push(account); // add to friends (but may be deleted if not active)
  } else if (addOrRemove === "remove friend") {
    // users[currentUser].friends = users[currentUser].friends.filter((a) => a !== account);
  }
  try {
    server.loadAccount(account).catch(function (error) {
      if (error instanceof StellarSdk.NotFoundError) {
        // console.log(account + "The destination account does not exist!");
        users[currentUser].friends = users[currentUser].friends.filter(
          (a) => a !== account
        );
      }
    });
  } catch (error) {
    console.log(error);
  }
}

async function build() {
  const result = await sortOperations();
  friendsLoaded = true;
  whatsNew.innerHTML = `<img src='${users[self].profileImage}' width=60 /0>`;
  mergeDataOperations();

  dataOperationsArray.forEach((element) => {
    const html = buildFeedItem(element);
    feed.insertAdjacentHTML("afterbegin", html);
    profileFeedList.insertAdjacentHTML("afterbegin", html);
  });
  updateFriendsList();
  updateProfileData();
}

function mergeDataOperations() {
  // for(let i = 0; i < dataOperationsArray.length; i++) {
  // dataOperationsArray
  const output = [];
  dataOperationsArray.forEach(function (operation) {
    let existing = output.filter(function (v, i) {
      return v.timestamp === operation.timestamp;
    });
    if (existing.length) {
      let existingIndex = output.indexOf(existing[0]);
      output[existingIndex].value = output[existingIndex].value.concat(
        operation.value
      );
    } else {
      if (typeof operation.value === "string")
        operation.value = [operation.value];
      output.push(operation);
    }
  });
  dataOperationsArray = output;

  dataOperationsArray.forEach((element) => {
    if (element.value) {
      for (let i = 0; i < element.value.length; i++) {
        element.value[i] = Base64.decode(Base64.decode(element.value[i]));
      }
      element.value = element.value.join("");
    }
  });
}

function sortOperations() {
  return new Promise((resolve) => {
    resolve(
      dataOperationsArray.sort(function (a, b) {
        return a.timestamp - b.timestamp;
      })
    );
  });
}

function buildFeedItem(element) {
  let list_item = "<li>";

  if (
    element.source_account ===
    "GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR"
  ) {
    // friendbot
    list_item += `<div class='feed-item'><div class='update'><div class='post_content' style="text-align: center;">
    <div class='profile-image'><span class='gray'><p>${timeSince(
      element.created_at
    )}</p></span><p>${
      element.account === self ? "You " : shorten_id(element.account)
    } created a Destrict.</p><div class='update_stats'><a href='${
      element.links_self_href
    }' target='_blank'><i class="fa fa-code" style="float:right;" aria-hidden="true"></i></a></div></div></div></div></div>`;
  }
  if (element.name === "post") {
    list_item += `
    <div class='feed-item'>
      <div class='post ${element.id}'>
        <div class='profile-image'><a href=""><img src='${
          users[element.source_account].profileImage
        }' width=60 /0></a></div>
        <div class='post_content'>
          <div class='username'>${
            users[element.source_account].username
          } <span class='gray'>@${shorten_id(
      element.source_account
    )} - ${timeSince(element.created_at)}</span>
          </div>
          <div class='post_box'>${element.value}</div>
          </div>
          </div>
          <div class='stats'><div class='comments-${
            element.id
          }'><a href='javascript:commentPost(${
      element.id
    })'><i class="fa fa-comment" aria-hidden="true">  0</i></a></div>
          <div class='repost-${element.id}'><a href='javascript:repostPost(${
      element.id
    })'><i class="fa fa-retweet" aria-hidden="true">  0</i></a></div>
          <div class='likes-${element.id}'><a href='javascript:likePost(${
      element.id
    })'><i class="fa fa-heart" aria-hidden="true"> ${
      element.likes
    }</i></a></div>
          <div class='share-${element.id}'><a href='javascript:sharePost(${
      element.id
    })'><i class="fa fa-share-alt" aria-hidden="true"> &nbsp;</i></a></div>
          <div class='code-${element.id}'><a href='${
      element.links_self_href
    }' target='_blank'><i class="fa fa-code" aria-hidden="true"> &nbsp;</i></a></div>
          
      </div>
    </div>`;
  }
  if (element.source_account === self) {
    if (
      element.name === "bio" ||
      element.name === "username" ||
      element.name === "profile image" ||
      element.name === "banner image" ||
      element.name === "location"
    ) {
      list_item += `<div class='feed-item profile_update hidden'><div class='update'><div class='post_content' style="text-align: center;"><p><span class='gray'>${timeSince(
        element.created_at
      )}</span></p><p>You updated your ${
        element.name
      }.</p><div class='update_stats'><a href='${
        element.links_self_href
      }' target='_blank'><i class="fa fa-code" style="float:right;" aria-hidden="true"></i></a></div></div></div></div>`;
    }
    if (element.name === "add friend") {
      list_item += `<div class='feed-item profile_update hidden'><div class='update'><div class='post_content' style="text-align: center;"><p><span class='gray'>${timeSince(
        element.created_at
      )}</span></p><p>You added ${shorten_id(
        element.value
      )}.</p><div class='update_stats'><a href='${
        element.links_self_href
      }' target='_blank'><i class="fa fa-code" style="float:right;" aria-hidden="true"></i></a></div></div></div></div>`;
    }
    if (element.name === "remove friend") {
      list_item += `<div class='feed-item profile_update hidden'><div class='update''><div class='post_content' style="text-align: center;"><p><span class='gray'>${timeSince(
        element.created_at
      )}</span></p><p>You and ${shorten_id(
        Base64.decode(element.value)
      )} are no longer friends!</p><div class='update_stats'><a href='${
        element.links_self_href
      }' target='_blank'><i class="fa fa-code" style="float:right;" aria-hidden="true"></i></a></div></div>`;
    }
  }

  list_item += "</li>";
  return list_item;
}

function getFriendsPosts() {
  // last friend's last operation
  if (users[`${self}`].friends[0]) {
    users[`${self}`].friends.forEach((element) => {
      asyncCall(element);
    });
  } else {
    build();
  }
}

const createChunks = function (data) {
  const chunks = [];
  const base64Data = Base64.encode(data);
  for (let i = 0; i < base64Data.length; i += 64) {
    chunks.push(base64Data.slice(i, i + 64));
  }

  return chunks;
};

// stellar transaction functions
async function addPost() {
  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  let post = whatsNewInput.value;
  if (!post) {
    post = prompt("What's happening?");
  }

  if (post) {
    whatsNewInput.value = "";
    const account = await server.loadAccount(self);
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    });
    post = createChunks(post);

    for (let i = 0; i < post.length; i++) {
      transaction
        .addOperation(
          StellarSdk.Operation.manageData({
            name: "post",
            value: post[i],
          })
        )
        .addOperation(
          StellarSdk.Operation.manageData({
            name: "post",
            value: null,
          })
        );
    }

    let newTransaction = transaction.setTimeout(30).build();
    siteMessage.classList.toggle("hidden");
    siteMessage.textContent =
      "adding to the blockchain.. please wait a few seconds..";
    newTransaction.sign(sourceKeypair);
    const transactionResult = await server.submitTransaction(newTransaction);
    setTimeout(() => {
      siteMessage.textContent = "";
      siteMessage.classList.toggle("hidden");
    }, 4000);
  }
}

async function addFriend(pk = "") {
  // add or remove? if it exists already in friends list it is a remove
  let addOrRemove = "add friend";

  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);

  if (!pk) {
    let pk = prompt("Enter their public key:");
  }
  // if exists change to 'remove friend'
  if (users[self].friends.includes(pk)) {
    addOrRemove = "remove friend";
  }

  const account = await server.loadAccount(self);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.manageData({
        name: addOrRemove,
        value: pk,
      })
    )
    .addOperation(
      StellarSdk.Operation.manageData({
        name: addOrRemove,
        value: null,
      })
    );

  let newTransaction = transaction.setTimeout(30).build();
  siteMessage.classList.toggle("hidden");
  siteMessage.textContent =
    "updating friends on the blockchain.. please wait a few seconds..";
  newTransaction.sign(sourceKeypair);
  const transactionResult = await server.submitTransaction(newTransaction);
  setTimeout(() => {
    siteMessage.textContent = "";
    siteMessage.classList.toggle("hidden");
    updateFriendsList();
  }, 4000);
}

// updates profile image, username, bio, location, and more..
async function updateProfile(item) {
  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  let post = prompt(`New ${item}:`);
  if (post) {
    post = Base64.encode(post);
    const account = await server.loadAccount(self);
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: item,
          value: post,
        })
      )
      .addOperation(
        StellarSdk.Operation.manageData({
          name: item,
          value: null,
        })
      );

    let newTransaction = transaction.setTimeout(30).build();
    siteMessage.classList.toggle("hidden");
    siteMessage.textContent = `adding ${item} to the blockchain.. please wait a few seconds.. changes may require refresh..`;
    newTransaction.sign(sourceKeypair);
    const transactionResult = await server.submitTransaction(newTransaction);
    setTimeout(() => {
      siteMessage.textContent = "";
      siteMessage.classList.toggle("hidden");
      updateProfileData();
    }, 4000);
  }
}

async function likePost(operationID) {
  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  const account = await server.loadAccount(self);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    // memo: ("MemoID", operationID),
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: self,
        asset: new StellarSdk.Asset("LIKE", self),
        amount: "1",
      })
    )
    .addMemo(new StellarSdk.Memo(StellarSdk.MemoID, String(operationID)))
    .setTimeout(30)
    .build();
  siteMessage.classList.toggle("hidden");
  siteMessage.textContent =
    "adding like to the blockchain.. please wait a few seconds..";
  transaction.sign(sourceKeypair);
  const transactionResult = await server.submitTransaction(transaction);
  setTimeout(() => {
    siteMessage.textContent = "";
    siteMessage.classList.toggle("hidden");
  }, 4000);
}

async function repostPost(operationID) {
  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  const account = await server.loadAccount(self);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    // memo: ("MemoID", operationID),
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: self,
        asset: new StellarSdk.Asset("REPOST", self),
        amount: "1",
      })
    )
    .addMemo(new StellarSdk.Memo(StellarSdk.MemoID, String(operationID)))
    .setTimeout(30)
    .build();
  siteMessage.classList.toggle("hidden");
  siteMessage.textContent =
    "adding repost to the blockchain.. please wait a few seconds..";
  transaction.sign(sourceKeypair);
  const transactionResult = await server.submitTransaction(transaction);
  setTimeout(() => {
    siteMessage.textContent = "";
    siteMessage.classList.toggle("hidden");
  }, 4000);
}

async function commentPost(operationID) {
  const fee = await server.fetchBaseFee();
  const sourceKeypair = StellarSdk.Keypair.fromSecret(selfSecret);
  const account = await server.loadAccount(self);
  const transaction = new StellarSdk.TransactionBuilder(account, {
    // memo: ("MemoID", operationID),
    fee,
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: self,
        asset: new StellarSdk.Asset("COMMENT", self),
        amount: "1",
      })
    )
    .addMemo(new StellarSdk.Memo(StellarSdk.MemoID, String(operationID)))
    .setTimeout(30)
    .build();
  siteMessage.classList.toggle("hidden");
  siteMessage.textContent =
    "adding comment to the blockchain.. please wait a few seconds..";
  transaction.sign(sourceKeypair);
  const transactionResult = await server.submitTransaction(transaction);
  setTimeout(() => {
    siteMessage.textContent = "";
    siteMessage.classList.toggle("hidden");
  }, 4000);
}

function updateFriendsList() {
  friendsListvar.innerHTML = "";
  users[self].friends.forEach((element) => {
    const result = addFriendList(element);
  });
}

function addFriendList(element) {
  let list_item = document.createElement("li");
  list_item.innerHTML = `<div class='friend-class'><div><img src='${
    users[element].profileImage
  }'></div><div>${users[element].username}</div><div>${shorten_id(
    element
  )}</div><div><i class="fal fa-trash" onclick="addFriend('${element}')"></div>`;
  friendsListvar.appendChild(list_item);
}

function updateProfileData() {
  const me = users[self];

  // profileIcon.innerHTML = `<img class='pic' src='${me.profileImage}'>`;
  document.querySelector(
    ".user"
  ).innerHTML = `<div style="float:right; padding-right: 20px;"><img src="${me.profileImage}" onclick="toggleProfile()"></div>`;

  document.querySelector(
    ".pic"
  ).innerHTML = `<img src='${me.profileImage}' onclick="updateProfile('profile image')">`;
  document.getElementById("profileUsername").textContent = me.username;
  document.getElementById(
    "publicKey"
  ).innerHTML = `<div id="public-qrcode" class="hidden">
  <canvas id="public_QR" class="qrcode"></canvas>
</div><div class="public-key" onclick="togglePublicKeyQR()">${shorten_id(
    self
  )}</div>`;
  const public_QR = document.getElementById("public_QR");
  new QRious({
    element: public_QR,
    background: "#fff",
    foreground: "#5868bf",
    size: 128,
    value: self,
  });
  document.getElementById("bio").textContent = me.bio;
  joinedDate.textContent = `Join Date: ${me.joinedDate}`;
  userLocation.textContent = me.userLocation;
  website.innerHTML = `<a href='https://destrict.org/${self}'>https://destrict.org/${shorten_id(
    self
  )}</a>`;
  following.textContent = users[self].friends.length + " following";
  followers.textContent = "??" + " followers";
}

// returns formatted time (e.g. 17 minutes ago)
// need to remove plurals when only 1- currently 1 "days" ago will print
function timeSince(date) {
  const date_object = new Date(date);
  let seconds = Math.floor((new Date() - date_object) / 1000);
  let interval = seconds / 31536000;

  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

// returns shortened (tiny) public key (e.g. "GAB3...HR3D")
function shorten_id(p) {
  return `${p[0]}${p[1]}${p[2]}${p[3]}...${p[52]}${p[53]}${p[54]}${p[55]}`;
}

// feed/friends/profile toggle functions
// condense this logic if possible
// toggles to feed screen (default)
function toggleFeed() {
  theFeed.classList.contains("hidden") && theFeed.classList.toggle("hidden");
  if (feedIcon.classList.contains("fal")) {
    feedIcon.classList.add("fas");
    feedIcon.classList.remove("fal");
  }
  !theFriends.classList.contains("hidden") &&
    theFriends.classList.toggle("hidden");
  if (friendsIcon.classList.contains("fas")) {
    friendsIcon.classList.add("fal");
    friendsIcon.classList.remove("fas");
  }
  !theProfile.classList.contains("hidden") &&
    theProfile.classList.toggle("hidden");
  if (profileIcon.classList.contains("fas")) {
    profileIcon.classList.add("fal");
    profileIcon.classList.remove("fas");
  }
}
// toggles to friends screen
function toggleFriends() {
  !theFeed.classList.contains("hidden") && theFeed.classList.toggle("hidden");
  if (feedIcon.classList.contains("fas")) {
    feedIcon.classList.add("fal");
    feedIcon.classList.remove("fas");
  }
  theFriends.classList.contains("hidden") &&
    theFriends.classList.toggle("hidden");
  if (friendsIcon.classList.contains("fal")) {
    friendsIcon.classList.add("fas");
    friendsIcon.classList.remove("fal");
  }
  !theProfile.classList.contains("hidden") &&
    theProfile.classList.toggle("hidden");
  if (profileIcon.classList.contains("fas")) {
    profileIcon.classList.add("fal");
    profileIcon.classList.remove("fas");
  }
}
// toggles to profile screen
function toggleProfile() {
  !theFeed.classList.contains("hidden") && theFeed.classList.toggle("hidden");
  if (feedIcon.classList.contains("fas")) {
    feedIcon.classList.add("fal");
    feedIcon.classList.remove("fas");
  }
  !theFriends.classList.contains("hidden") &&
    theFriends.classList.toggle("hidden");
  if (friendsIcon.classList.contains("fas")) {
    friendsIcon.classList.add("fal");
    friendsIcon.classList.remove("fas");
  }
  theProfile.classList.contains("hidden") &&
    theProfile.classList.toggle("hidden");
  if (profileIcon.classList.contains("fal")) {
    profileIcon.classList.add("fas");
    profileIcon.classList.remove("fal");
  }
}

// toggle edit profile buttons
function toggleEditProfile() {
  const items = document.querySelectorAll(".small-edit");
  const names = document.querySelectorAll(".edit-title");
  items.forEach((item) => {
    item.classList.toggle("hidden");
  });
  names.forEach((name) => {
    name.classList.toggle("hidden");
  });
}

// show profile update posts
function toggleProfileUpdates() {
  const profileUpdatesNodeList = document.querySelectorAll(".profile_update");
  profileUpdatesNodeList.forEach((update) => {
    update.classList.toggle("hidden");
  });
}

// show QR code of public key
function togglePublicKeyQR() {
  const publicQR = document.getElementById("public-qrcode");
  publicQR.classList.toggle("hidden");
}
