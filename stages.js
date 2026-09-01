window.STEGON_STAGES = [
  {
    id: 1,
    size: 3,
    maxMoves: 6,
    goal: { type: "collect", tile: "grass", count: 6 },
    initialBoard: [
      "grass", "berry", "grass",
      "berry", "berry", "grass",
      "grass", "berry", "berry"
    ],
    refill: ["grass", "berry", "grass", "berry", "berry", "grass", "grass", "berry"]
  },
  {
    id: 2,
    size: 4,
    maxMoves: 8,
    goal: { type: "collect", tile: "berry", count: 10 },
    initialBoard: [
      "grass", "berry", "grass", "berry",
      "berry", "grass", "berry", "grass",
      "grass", "grass", "berry", "berry",
      "berry", "grass", "grass", "berry"
    ],
    refill: ["berry", "grass", "berry", "grass", "grass", "berry", "berry", "grass"]
  },
  {
    id: 3,
    size: 5,
    maxMoves: 10,
    goal: { type: "collect", tile: "grass", count: 16 },
    initialBoard: [
      "grass", "berry", "grass", "berry", "grass",
      "berry", "grass", "berry", "grass", "berry",
      "grass", "grass", "berry", "berry", "grass",
      "berry", "grass", "grass", "berry", "berry",
      "grass", "berry", "berry", "grass", "grass"
    ],
    refill: ["grass", "berry", "berry", "grass", "berry", "grass", "grass", "berry", "grass", "berry"]
  }
];
