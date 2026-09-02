(() => {
  "use strict";

  const TYPES = ["grass", "berry"];
  const ICONS = { grass: "🌿", berry: "🍓" };
  const FLIP = { grass: "berry", berry: "grass" };

  const boardEl = document.getElementById("board");
  const stageNumberEl = document.getElementById("stageNumber");
  const movesLeftEl = document.getElementById("movesLeft");
  const chainCountEl = document.getElementById("chainCount");
  const goalTextEl = document.getElementById("goalText");
  const goalBarEl = document.getElementById("goalBar");
  const messageEl = document.getElementById("message");
  const restartButton = document.getElementById("restartButton");
  const nextButton = document.getElementById("nextButton");

  let stageIndex = 0;
  let stage = null;
  let board = [];
  let movesUsed = 0;
  let collected = { grass: 0, berry: 0 };
  let refillIndex = 0;
  let busy = false;
  let cleared = false;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function loadStage(index) {
    stageIndex = Math.max(0, Math.min(index, window.STEGON_STAGES.length - 1));
    stage = window.STEGON_STAGES[stageIndex];
    board = [...stage.initialBoard];
    movesUsed = 0;
    collected = { grass: 0, berry: 0 };
    refillIndex = 0;
    busy = false;
    cleared = false;
    nextButton.disabled = true;
    messageEl.className = "message";
    messageEl.textContent = "パネルをタップすると、上下左右もくるりん！";
    chainCountEl.textContent = "0";
    render();
  }

  function render(options = {}) {
    const { dropOffsets = null, spawnIndices = null } = options;

    stageNumberEl.textContent = stage.id;
    movesLeftEl.textContent = `${Math.max(0, stage.maxMoves - movesUsed)}手`;
    const goalNow = collected[stage.goal.tile] || 0;
    goalTextEl.textContent = `${ICONS[stage.goal.tile]}を ${stage.goal.count}こ あつめよう（${Math.min(goalNow, stage.goal.count)}/${stage.goal.count}）`;
    goalBarEl.style.width = `${Math.min(100, goalNow / stage.goal.count * 100)}%`;

    boardEl.style.setProperty("--size", stage.size);
    boardEl.innerHTML = "";

    board.forEach((type, index) => {
      const tile = document.createElement("button");
      tile.className = "tile";
      tile.type = "button";
      tile.dataset.type = type || "empty";
      tile.dataset.index = String(index);
      tile.setAttribute("role", "gridcell");
      tile.setAttribute("aria-label", type === "grass" ? "草パネル" : type === "berry" ? "木の実パネル" : "空きマス");
      tile.textContent = type ? ICONS[type] : "";
      tile.disabled = busy || cleared || !type;
      tile.addEventListener("click", () => handleMove(index));
      boardEl.appendChild(tile);
    });

    const tiles = [...boardEl.querySelectorAll(".tile")];
    const sampleTile = tiles.find(tile => tile.dataset.type !== "empty");
    const styles = getComputedStyle(boardEl);
    const gap = parseFloat(styles.rowGap || styles.gap) || 0;
    const step = sampleTile ? sampleTile.getBoundingClientRect().height + gap : 0;

    if (dropOffsets) {
      dropOffsets.forEach((rows, index) => {
        const tile = tiles[index];
        if (!tile || rows <= 0) return;
        tile.style.setProperty("--drop-y", `${-(rows * step)}px`);
        tile.classList.add("dropping");
      });
    }

    if (spawnIndices) {
      spawnIndices.forEach(index => {
        const tile = tiles[index];
        if (!tile) return;
        tile.classList.add("spawning");
      });
    }
  }

  function neighbors(index) {
    const size = stage.size;
    const row = Math.floor(index / size);
    const col = index % size;
    const points = [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];
    return points
      .filter(([r, c]) => r >= 0 && c >= 0 && r < size && c < size)
      .map(([r, c]) => r * size + c);
  }

  function popChain(chain) {
    chainCountEl.classList.remove("chain-pop");
    messageEl.classList.remove("chain-pop");
    void chainCountEl.offsetWidth;
    chainCountEl.classList.add("chain-pop");
    messageEl.classList.add("chain-pop");

    if (chain >= 2 && navigator.vibrate) {
      navigator.vibrate(chain >= 3 ? [25, 25, 35] : 25);
    }
  }

  async function handleMove(index) {
    if (busy || cleared || movesUsed >= stage.maxMoves) return;
    busy = true;
    movesUsed += 1;
    chainCountEl.textContent = "0";

    const affected = neighbors(index);
    const tiles = [...document.querySelectorAll(".tile")];
    tiles.forEach((tile, i) => {
      tile.disabled = true;
      if (affected.includes(i)) {
        tile.style.transform = "scale(1.06)";
        tile.style.boxShadow = "0 0 0 4px rgba(255, 210, 73, .78), inset 0 -5px 0 rgba(0,0,0,.08)";
      }
    });

    await sleep(180);
    tiles.forEach((tile, i) => {
      if (affected.includes(i)) {
        tile.style.transform = "";
        tile.style.boxShadow = "";
        tile.classList.add("flipping");
      }
    });
    await sleep(130);

    affected.forEach(i => { board[i] = FLIP[board[i]]; });
    render();
    await sleep(130);

    let chain = 0;
    while (true) {
      const matches = findMatches();
      if (matches.size === 0) break;

      chain += 1;
      chainCountEl.textContent = String(chain);
      messageEl.textContent = chain === 1 ? "けせた！" : `${chain}れんさ！`;
      popChain(chain);
      await clearMatches(matches);

      // 連鎖中は新しいパネルを補充しない。
      // 残ったパネルが実際に下へ落ち、その結果で次の連鎖を判定する。
      const dropOffsets = collapseBoard();
      render({ dropOffsets });
      await sleep(300);
    }

    // 連鎖終了後だけ補充。補充そのものでは偶然3つ揃わない。
    if (board.some(value => value === null)) {
      const spawnIndices = refillSafely();
      render({ spawnIndices });
      await sleep(270);
    }

    if (checkClear()) {
      cleared = true;
      messageEl.className = "message success";
      messageEl.textContent = "クリア！ ステゴンもうれしそう。";
      nextButton.disabled = stageIndex >= window.STEGON_STAGES.length - 1;
    } else if (movesUsed >= stage.maxMoves) {
      messageEl.className = "message";
      messageEl.textContent = "あとちょっと。やりなおしてみよう！";
    } else if (chain === 0) {
      messageEl.textContent = "こんどは、3つならぶ場所をさがしてみよう。";
    }

    busy = false;
    render();
  }

  function findMatches() {
    const size = stage.size;
    const matches = new Set();

    for (let r = 0; r < size; r += 1) {
      let c = 0;
      while (c < size) {
        const type = board[r * size + c];
        if (!type) {
          c += 1;
          continue;
        }

        let end = c + 1;
        while (end < size && board[r * size + end] === type) end += 1;
        if (end - c >= 3) {
          for (let x = c; x < end; x += 1) matches.add(r * size + x);
        }
        c = end;
      }
    }

    for (let c = 0; c < size; c += 1) {
      let r = 0;
      while (r < size) {
        const type = board[r * size + c];
        if (!type) {
          r += 1;
          continue;
        }

        let end = r + 1;
        while (end < size && board[end * size + c] === type) end += 1;
        if (end - r >= 3) {
          for (let y = r; y < end; y += 1) matches.add(y * size + c);
        }
        r = end;
      }
    }

    return matches;
  }

  async function clearMatches(matches) {
    document.querySelectorAll(".tile").forEach((tile, index) => {
      if (matches.has(index)) tile.classList.add("clearing");
    });
    await sleep(220);

    matches.forEach(index => {
      const type = board[index];
      if (type) collected[type] += 1;
      board[index] = null;
    });
  }

  function collapseBoard() {
    const size = stage.size;
    const dropOffsets = new Map();

    for (let c = 0; c < size; c += 1) {
      const remaining = [];

      for (let r = size - 1; r >= 0; r -= 1) {
        const index = r * size + c;
        const value = board[index];
        if (value) remaining.push({ value, fromRow: r });
      }

      for (let r = 0; r < size; r += 1) board[r * size + c] = null;

      remaining.forEach((entry, offset) => {
        const targetRow = size - 1 - offset;
        const targetIndex = targetRow * size + c;
        board[targetIndex] = entry.value;
        const rowsDropped = targetRow - entry.fromRow;
        if (rowsDropped > 0) dropOffsets.set(targetIndex, rowsDropped);
      });
    }

    return dropOffsets;
  }

  function refillSafely() {
    const size = stage.size;
    const spawnIndices = new Set();

    for (let c = 0; c < size; c += 1) {
      for (let r = size - 1; r >= 0; r -= 1) {
        const index = r * size + c;
        if (board[index] !== null) continue;

        const preferred = nextRefill();
        const alternate = FLIP[preferred];

        if (!wouldCreateMatch(index, preferred)) {
          board[index] = preferred;
        } else if (!wouldCreateMatch(index, alternate)) {
          board[index] = alternate;
        } else {
          board[index] = preferred;
        }

        spawnIndices.add(index);
      }
    }

    return spawnIndices;
  }

  function wouldCreateMatch(index, type) {
    const size = stage.size;
    const row = Math.floor(index / size);
    const col = index % size;
    const previous = board[index];
    board[index] = type;

    let horizontal = 1;
    for (let c = col - 1; c >= 0 && board[row * size + c] === type; c -= 1) horizontal += 1;
    for (let c = col + 1; c < size && board[row * size + c] === type; c += 1) horizontal += 1;

    let vertical = 1;
    for (let r = row - 1; r >= 0 && board[r * size + col] === type; r -= 1) vertical += 1;
    for (let r = row + 1; r < size && board[r * size + col] === type; r += 1) vertical += 1;

    board[index] = previous;
    return horizontal >= 3 || vertical >= 3;
  }

  function nextRefill() {
    if (stage.refill && stage.refill.length) {
      const value = stage.refill[refillIndex % stage.refill.length];
      refillIndex += 1;
      return value;
    }

    const value = TYPES[refillIndex % TYPES.length];
    refillIndex += 1;
    return value;
  }

  function checkClear() {
    return (collected[stage.goal.tile] || 0) >= stage.goal.count;
  }

  restartButton.addEventListener("click", () => loadStage(stageIndex));
  nextButton.addEventListener("click", () => loadStage(stageIndex + 1));

  loadStage(0);
})();