window.STEGON_STAGES = [
  {
    id: 1,
    size: 3,
    maxMoves: 6,
    goal: { type: "collect", tile: "grass", count: 6 },
    initialBoard: [
      "berry", "berry", "grass",
      "berry", "grass", "berry",
      "grass", "berry", "grass"
    ],
    refill: ["grass", "berry", "grass", "berry", "berry", "grass", "grass", "berry"]
  },
  {
    id: 2,
    size: 4,
    maxMoves: 8,
    goal: { type: "collect", tile: "berry", count: 14 },
    initialBoard: [
      "grass", "berry", "grass", "berry",
      "berry", "grass", "berry", "grass",
      "grass", "berry", "grass", "berry",
      "berry", "grass", "berry", "grass"
    ],
    refill: ["berry", "grass", "berry", "grass", "grass", "berry", "berry", "grass"]
  },
  {
    id: 3,
    size: 5,
    maxMoves: 10,
    goal: { type: "collect", tile: "grass", count: 28 },
    initialBoard: [
      "grass", "grass", "berry", "grass", "berry",
      "berry", "grass", "berry", "grass", "berry",
      "grass", "berry", "grass", "berry", "grass",
      "berry", "grass", "berry", "grass", "berry",
      "grass", "berry", "grass", "berry", "grass"
    ],
    refill: ["grass", "berry", "berry", "grass", "berry", "grass", "grass", "berry", "grass", "berry"]
  }
];
