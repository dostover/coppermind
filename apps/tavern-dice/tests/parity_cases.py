"""Generate random Resolution cases with the simulator's rules engine, so the
table app's engine can be checked against it (tests/e2e.js).
Usage: python3 tests/parity_cases.py [n] [seed] > /tmp/parity.json"""
import json, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'sim'))
import tavern_sim as T
n = int(sys.argv[1]) if len(sys.argv) > 1 else 400
rng = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 1)
names = [d for d in T.FACES if d not in ('Viper2', 'Inquisitor')]
cases = []
for _ in range(n):
    side = []
    for _ in range(2):
        dice = rng.sample(names, 5)
        p = T.Player('x', dice); p.res = [rng.choice(T.FACES[d]) for d in dice]
        p.R = rng.randint(1, 10); p.G = rng.randint(0, 5); side.append(p)
    turn = rng.randint(1, 12)
    d = T.outcome(side[0], side[1], detail=True, rnd=turn)
    cases.append(dict(turn=turn, p=[dict(dice=p.dice, res=p.res, R=p.R, G=p.G) for p in side],
                      expect=[[d['Rx'], d['Gx']], [d['Ry'], d['Gy']]]))
json.dump(cases, sys.stdout)
