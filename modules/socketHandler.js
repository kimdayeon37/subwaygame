const { Server } = require("socket.io");
const socketHandler = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000", // 허용할 host
      methods: ["GET", "POST"], // 하용할 method
    },
  });

  let user = {};
  let readyUsers = [];
  let allUsers = [];
  let answers = [];
  let idNames = {};
  io.on("connection", (socket) => {
    // 접속 시 서버에서 실행되는 코드
    const req = socket.request;
    const socket_id = socket.id; //id 자동배정
    const client_ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress; //ip주소
    allUsers.push(socket_id);
    console.log("myId", socket.id);

    // 처음 들어오면 채팅방은 안보여줌
    io.to(socket_id).emit("hideChat", ["nonFlex", "game-chat"]);
    user[socket.id] = { nickname: "users nickname", point: 0 };
    // 새로 접속한 유저한테 보내줌
    if (readyUsers.length === 3) {
      io.to(socket_id).emit("alreadyStart", readyUsers.length);
    }

    socket.on("ready", (data) => {
      idNames = { ...idNames, ...data.idName };
      console.log(readyUsers);
      if (data.isReplay) {
        readyUsers = [];
      } else {
        if (readyUsers.length < 3) {
          readyUsers.push(data.currId);
          const set = new Set(readyUsers);
          readyUsers = [...set];
          const { idName } = data;
          readyUsers.forEach((id) => {
            io.to(id).emit("startGame", { readyUsers, idNames });
          });
          let otherUser = allUsers.filter((user) => !readyUsers.includes(user));
          otherUser.forEach((id) => {
            io.to(id).emit("alreadyStart", readyUsers.length);
          });
        }
      }
    });
    socket.on("timerData", (data) => {
      if (data) {
        io.emit("overTime", true);
      } else {
      }
    });
    // 이겼을 때 점수추가
    socket.on("win", () => {
      user[socket.id].point++;
    });
    // 새로고침시
    socket.on("disconnect", () => {
      // 사전 정의 된 callback (disconnect, error)
      // delete user[socket.id];
      io.emit("test", socket.id);
      if (readyUsers.includes(socket.id)) {
        console.log("readyUser", readyUsers);
        readyUsers.forEach((user) => {
          io.to(user).emit("reStart", true);
        });
        readyUsers = [];
      }
    });
    // 이벤트 리스너 등록
    socket.on("event1", (msg) => {
      // 생성한 이벤트 이름 event1 호출 시 실행되는 callback
      socket.emit("getID", socket.id); // 이벤트를 발생시킨 클라이언트1에게 getID라는 임의의 아이디를 날림
    });
    // 데이터에는 현재 대답할 순서인 유저가 담겨있음
    socket.on("currentTurn", (data) => {
      const { user, index, idNames } = data;

      io.emit("myTurn", { user, index, idNames });
    });
    // readyUser 초기화
    socket.on("reset", (data) => {
      if (data) {
        readyUsers = [];
      }
    });
    // 다시하기
    socket.on("replay", (data) => {
      readyUsers.push(data);
      const set = new Set(readyUsers);
      readyUsers = [...set];
      socket.emit("ready", data);
      readyUsers.forEach((id) => {
        io.to(id).emit("startGame", { readyUsers, idNames });
      });
    });

    // 점수 기록
    socket.on("record", (data) => {
      let userData = data.scoredUser;
      let newUsers = data.scoredUsers;
      newUsers.forEach((user, index) => {
        if (userData.includes(user.id)) {
          newUsers[index].score = newUsers[index].score + 1;
          let indexOfUser = userData.indexOf(user.id);
          userData.splice(indexOfUser, 1);
        }
      });
      userData.forEach((data) => {
        if (!!newUsers) {
          newUsers.push({ id: data, score: 1 });
        } else {
          newUsers = userData;
        }
      });
      readyUsers.forEach((data) => {
        io.to(data).emit("result", { newUsers, idNames });
      });
    });
    // 모두에게
    socket.on("input", (data) => {
      const { currId, msg } = data;
      answers.push(msg);
      io.emit("chatting", { id: currId, msg: msg, answers: answers, idNames });
    });

    // 본인 제외한 모든 소켓
    socket.on("inputWM", (data) => {
      socket.broadcast.emit("msg", { id: socket.id, message: data });
    });

    // 특정 소켓
    socket.on("private", (id, data) => {
      io.to(id).emit("msg", { id: socket.id, message: data });
    });

    // 방만들기 (같은 그룹에 속한 socket들에 대해 한번에 이벤트 발송)
    socket.on("joinRoom", function (msg) {
      let roomName = msg;
      socket.join(roomName);
    });
    socket.on("chatting", function (msg) {
      io.to(msg.roomName).emit("broadcast", msg.msg);
    });
  });
};
module.exports = socketHandler;
