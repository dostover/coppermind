#!/usr/bin/env python3
"""
Tavern Dice simulator — rules v0.9 (defaults); older rule options kept as RULES switches

Implements every die ability, all six universal Gold abilities, Last Call and
sudden death. Both players are driven by the same greedy AI: on its turn in the
action window a player evaluates every legal action by its expected effect on
the end-of-round outcome and takes the best one, or passes. The window closes
when both players pass in a row.

Usage
  python3 tavern_sim.py match --a Soldier,Guardian,Knight,Cleric,Oracle \
                              --b Gambler,Dragon,Mage,Assassin,Berserker -v
  python3 tavern_sim.py field --games 4000          # per-die win rates
  python3 tavern_sim.py vs --a ... --b ... --games 2000

Symbols in code: A=⚔  D=🛡  G=💰  H=♥  S=☠
"""
import argparse, random, itertools, math, sys
from collections import Counter, defaultdict

# --------------------------------------------------------------------------- dice
FACES = {
    'Soldier':   ['A', 'A', 'D', 'D', 'AD', 'G'],
    'Berserker': ['A', 'A', 'AA', 'L', 'S', 'D'],
    'Guardian':  ['D', 'D', 'D', 'DD', 'A', 'S'],
    'Gambler':   ['G', 'G', 'GG', 'GGG', 'S', 'S'],
    'Thief':     ['G', 'G', 'G', 'GA', 'A', 'S'],
    'Archer':    ['A', 'A', 'L', 'AA', 'D', 'G'],
    'Cleric':    ['D', 'D', 'H', 'H', 'HH', 'DH'],
    'Mage':      ['A', 'A', 'AA', 'AG', 'G', 'S'],
    'Druid':     ['A', 'D', 'H', 'DH', 'AD', 'G'],
    'Bard':      ['A', 'D', 'H', 'G', 'GA', 'DH'],
    'Assassin':  ['A', 'A', 'A', 'AA', 'P', 'A'],
    'Paladin':   ['A', 'D', 'D', 'DH', 'H', 'AD'],
    'Dragon':    ['A', 'L', 'AA', 'G', 'G', 'S'],
    'Fey':       ['A', 'D', 'H', 'G', 'AD', 'S'],
    'Dwarven':   ['A', 'A', 'D', 'D', 'DD', 'G'],
    'Goblin':    ['A', 'G', 'G', 'GG', 'P', 'S'],
    'Undead':    ['P', 'A', 'A', 'AA', 'D', 'H'],
    'Elemental': ['A', 'A', 'A', 'D', 'G', 'S'],
    'Knight':    ['A', 'D', 'D', 'S', 'DD', 'AD'],
    'Warlock':   ['A', 'AA', 'S', 'S', 'G', 'GG'],
    'Alchemist': ['G', 'G', 'H', 'HH', 'GH', 'S'],
    'Monster':   ['AA', 'AA', 'AAA', 'A', 'S', 'S'],
    'Oracle':    ['D', 'S', 'G', 'G', 'A', 'H'],
    'Mimic':     ['A', 'D', 'G', 'H', 'AD', 'S'],
    'Basic':     ['D', 'D', 'A', 'A', 'G', 'G'],
    'Viper':     ['AP', 'AP', 'P', 'A', 'G', 'S'],
    # Expansion 1 (v0.8 playtest)
    'Brawler':   ['A', 'A', 'A', 'D', 'G', ''],
    'Shieldbearer': ['D', 'D', 'D', 'A', 'G', ''],
    'Peddler':   ['G', 'G', 'A', 'D', 'H', ''],
    'Stormcaller': ['A', 'L', 'D', 'G', 'A', 'A'],
    'Apothecary': ['P', 'P', 'AP', 'H', 'G', 'S'],
    'Tempest':   ['L', 'AA', 'AA', 'D', 'G', 'S'],
    'Plaguebringer': ['P', 'PP', 'AP', 'D', 'H', 'S'],
    # Expansion 2 "Coin & Cure" (playtest)
    'Pilgrim':   ['H', 'H', 'D', 'A', 'A', ''],
    'Barkeep':   ['G', 'G', 'H', 'D', 'A', 'G'],
    'Moneylender': ['G', 'GG', 'A', 'D', 'AG', 'S'],
    'Taxman': ['G', 'A', 'D', 'G', 'AG', 'S'],
    'Sawbones':  ['H', 'HH', 'DD', 'A', 'AH', 'S'],
    'Puppeteer': ['G', 'A', 'D', 'H', 'AD', 'AA'],
    'Hydra':     ['A', 'AA', 'AA', 'D', 'H', 'S'],
    # Expansion 3 "Tavern Regulars" (all Common)
    'Bouncer':   ['D', 'D', 'A', 'D', 'A', 'G'],
    'Cook':      ['H', 'H', 'D', 'A', 'G', 'DH'],
    'Minstrel':  ['H', 'G', 'A', 'D', 'G', 'A'],
    'Brewer':    ['G', 'G', 'H', 'D', 'A', 'G'],
    'Drunkard':  ['AA', 'A', 'A', 'S', 'D', 'A'],
    'Watchman':  ['D', 'D', 'A', 'A', 'AD', 'G'],
    'Smith':     ['A', 'A', 'D', 'A', 'G', 'D'],
    'Cardsharp': ['G', 'G', 'A', 'D', 'AG', 'H'],
    'Ratcatcher': ['A', 'A', 'P', 'D', 'G', 'A'],
    'Fisher':    ['G', 'G', 'H', 'D', 'A', 'DH'],
    'Militia':   ['A', 'D', 'A', 'D', 'A', 'H'],
    'Herbalist': ['H', 'H', 'P', 'D', 'A', 'G'],
}
# Optional prototype dice (added to FACES by experiments)
EXTRA_DICE = {'Viper': ['A', 'A', 'P', 'P', 'AP', 'S'],
              'Viper2': ['AP', 'AP', 'P', 'A', 'G', 'S']}
ABIL = {
    'Soldier': 'formation', 'Berserker': 'bloodlust', 'Guardian': 'standfast',
    'Gambler': 'highroller', 'Thief': 'pickpocket', 'Archer': 'precise',
    'Cleric': 'blessing', 'Mage': 'surge', 'Druid': 'wildshape', 'Bard': 'inspiration',
    'Assassin': 'backstab', 'Paladin': 'divine', 'Dragon': 'hoard', 'Fey': 'trickster',
    'Dwarven': 'stubborn', 'Goblin': 'sneaky', 'Undead': 'relentless',
    'Elemental': 'volatile', 'Knight': 'counter', 'Warlock': 'bargain',
    'Alchemist': 'transmute', 'Monster': None, 'Oracle': 'omen', 'Mimic': 'imitate',
    'Viper': 'envenom', 'Viper2': 'envenom', 'Basic': None, 'Inquisitor': 'envenom', 'Brawler': None, 'Shieldbearer': None, 'Peddler': None, 'Stormcaller': 'arc', 'Apothecary': 'coat', 'Tempest': 'chain', 'Plaguebringer': 'epidemic', 'Pilgrim': None, 'Barkeep': 'lastorders', 'Moneylender': 'loan', 'Taxman': 'levy', 'Sawbones': 'triage', 'Puppeteer': 'strings', 'Hydra': 'regrow',
    'Bouncer': 'doorman', 'Cook': 'hearty', 'Minstrel': 'rousing', 'Brewer': 'brew', 'Drunkard': 'courage',
    'Watchman': 'nightwatch', 'Smith': 'sunder', 'Cardsharp': 'streak', 'Ratcatcher': 'pest', 'Fisher': 'patient',
    'Militia': 'rally', 'Herbalist': 'antidote',
}
EXP3 = ['Bouncer', 'Cook', 'Minstrel', 'Brewer', 'Drunkard', 'Watchman', 'Smith', 'Cardsharp', 'Ratcatcher', 'Fisher', 'Militia', 'Herbalist']
# Order in which Mimic prefers to copy abilities present in its loadout.
MIMIC_PRIORITY = ['wildshape', 'counter', 'standfast', 'hoard', 'omen', 'transmute',
                  'trickster', 'surge', 'formation', 'backstab', 'precise', 'divine',
                  'inspiration', 'blessing', 'highroller', 'bloodlust', 'pickpocket',
                  'volatile', 'bargain', 'stubborn', 'relentless', 'sneaky', 'envenom']
SYM = {'A': '⚔', 'D': '🛡', 'G': '💰', 'H': '♥', 'S': '☠', 'P': '☣', 'L': '⚡'}

START_RESOLVE = 10
LAST_CALL_ROUND = 6
GOLD_VALUE = 0.5          # AI: how many Resolve one Gold is worth
MIN_GAIN = 0.05           # AI: ignore actions that gain less than this
MAX_ROUNDS = 40

# Rule switches for experiments
RULES = {'counter': True, 'omen': True,
         'cap': 10,            # max Resolve (None = uncapped)
         'flex': 'gold',       # Wild Shape / Inspiration: 'free' (once/round), 'gold' (1 Gold, once/round), 'match' (once per match)
         'dko': 'higher',      # double KO: 'rolloff' or 'higher' (higher Resolve wins, roll-off on tie)
         'sneaky': 'dirty',
         'pierce': None,       # faces with at least this many ⚔ can't be blocked (None = off)
         'standfast_cond': True,  # Stand Fast only when Guardian shows 🛡
         'counter_min': 2,
         'poison_cap': 3,
         'poison': 'stripdie',
         'antidote': False,
         'omen_self': True,   # Omen's free Reroll only for the Oracle die itself
         'envenom_cost': 1,
         'swap': True,
         'format': 'match',
         'swap_n': 2,          # dice each player may swap before rounds 2 and 3
         'grudge': False,
         'lc_noheal': True,
         'two_step': True}    # v0.9 candidate: Influence = Fortune (rerolls, Distract) then Tactics (abilities, Jam)   # during Last Call (turn 6+), ♥ restores nothing      # Dwarven: Grudge (+1 damage if opponent shows ♥) instead of Stubborn   # 'match' (v0.6: best of 3 rounds, active player alternates each turn, Tavern Swap between rounds) or 'single'        # Tavern Swap: once per match, from round 2, swap one loadout die for a bench die    # corrode mode: each ♥ may cancel one opposing ☣ instead of healing      # ☣ mode: 'dot' (tokens, 1 dmg/round, ♥ cleanses) or 'corrode' (each ☣ removes one opponent 🛡 this round)      # max Poison tokens on a player     # Counterattack needs at least this many opponent ⚔ blocked    # Goblin: 'old' (= Reroll, no effect) or 'dirty' (pay 1 Gold: ☠ hits opponent instead)


def fs(face):
    return '[' + ''.join(SYM[c] for c in face) + ']'


# ------------------------------------------------------------------------ player
class Player:
    __slots__ = ('name', 'dice', 'res', 'extra', 'R', 'G', 'jam', 'used', 'surge',
                 'divine', 'mimic', 'omen_used', 'rel', 'vbonus', 'gused', 'sneak', 'poison', 'venom')

    def __init__(self, name, dice):
        self.name = name
        self.dice = list(dice)
        self.res = [None] * len(dice)
        self.extra = []              # (die index, face) extra results that also resolve
        self.R = START_RESOLVE
        self.G = 0
        self.rel = set()             # Relentless already used (per game)
        self.gused = set()           # once-per-match abilities used
        self.poison = 0              # Poison tokens (persist between rounds)
        self.new_round()

    def new_round(self):
        self.extra = []
        self.jam = set()
        self.used = set()
        self.surge = set()
        self.divine = 0
        self.mimic = None
        self.omen_used = 0
        self.vbonus = 0
        self.sneak = set()
        self.venom = set()           # this player's dice whose ♥ is negated (Envenom)

    def copy(self):
        q = Player.__new__(Player)
        q.name = self.name; q.dice = self.dice; q.res = self.res[:]; q.extra = self.extra[:]
        q.R = self.R; q.G = self.G; q.jam = set(self.jam); q.used = set(self.used)
        q.surge = set(self.surge); q.divine = self.divine; q.mimic = self.mimic
        q.omen_used = self.omen_used; q.rel = set(self.rel); q.vbonus = self.vbonus
        q.gused = set(self.gused); q.sneak = set(self.sneak); q.poison = self.poison; q.venom = set(self.venom)
        return q


def ab(p, i):
    """Effective ability of die i (None if Jammed or no ability)."""
    if i in p.jam:
        return None
    a = ABIL[p.dice[i]]
    if a == 'imitate':
        a = p.mimic
    if a == 'counter' and not RULES['counter']:
        return None
    if a == 'omen' and not RULES['omen']:
        return None
    if a == 'stubborn' and RULES['grudge']:
        return 'grudge'
    return a


def omen_free(p):
    return sum(1 for i in range(len(p.dice)) if ab(p, i) == 'omen') - p.omen_used


# -------------------------------------------------------------------- resolution
def totals(X, Y):
    fl = list(enumerate(X.res)) + X.extra
    S = H = D = 0
    push = 0
    for i, f in fl:
        if i in X.sneak and 'S' in f:
            push += f.count('S')
        else:
            S += f.count('S')
        if i not in X.venom:
            H += f.count('H')
        D += f.count('D')
    for i, f in enumerate(X.res):                       # Formation
        if 'D' in f and ab(X, i) == 'formation':
            if any('D' in g for j, g in fl if j != i):
                D += 1
    D += X.divine                                        # Divine Protection
    y_shows_def = any('D' in f for f in Y.res) or any('D' in f for _, f in Y.extra)
    atk_idx = {i for i, f in fl if 'A' in f}
    A = U = gold = steal = 0
    U += sum(f.count('L') for _, f in fl)          # ⚡ Lightning: unblockable
    for i, f in fl:
        a = ab(X, i)
        na, ng = f.count('A'), f.count('G')
        if na:
            if a == 'bloodlust':
                na += S                                  # +1 per ☠ that hits you
            elif a == 'precise' and atk_idx == {i}:
                na += 1
            elif a == 'backstab' and not y_shows_def:
                na += 1
            raw = f.count('A')
            if (a == 'surge' and i in X.surge) or (RULES['pierce'] and raw >= RULES['pierce']):
                U += na
            else:
                A += na
        if ng:
            if a == 'pickpocket':
                steal += ng
            else:
                gold += ng + (1 if a == 'hoard' else 0)
    y_heals = any('H' in f for f in Y.res) or any('H' in f for _, f in Y.extra)
    if y_heals:
        A += sum(1 for i in range(len(X.res)) if ab(X, i) == 'grudge')
    y_def = sum(f.count('D') for f in Y.res) + sum(f.count('D') for _, f in Y.extra)
    for i, f in enumerate(X.res):
        a_ = ab(X, i)
        if a_ == 'lastorders' and _RND[0] >= LAST_CALL_ROUND:
            A += f.count('G')
        if a_ == 'regrow' and 'S' in f:
            A += 2
    for i, f in enumerate(X.res):
        if ab(X, i) == 'arc' and 'L' in f and y_def >= 2:
            U += 1
        if ab(X, i) == 'chain' and 'L' in f:
            k = min(2, sum(1 for j, g in enumerate(X.res) if j != i and 'A' in g))
            A -= k; U += k
    # Expansion 3 passives
    y_atk = sum(f.count('A') for f in Y.res) + sum(f.count('A') for _, f in Y.extra)
    y_skull = any('S' in f for f in Y.res) or any('S' in f for _, f in Y.extra)
    x_gold_dice = sum(1 for f in X.res if 'G' in f)
    for i, f in enumerate(X.res):
        a_ = ab(X, i)
        if not a_:
            continue
        if a_ == 'doorman' and 'D' in f and y_atk >= 3: D += 1
        elif a_ == 'hearty' and 'H' in f and X.R <= 5 and i not in X.venom: H += 1
        elif a_ == 'rousing' and 'H' in f and any('A' in g for j, g in enumerate(X.res) if j != i): A += 1
        elif a_ == 'brew' and 'H' in f: gold += 1
        elif a_ == 'courage' and 'A' in f and X.R <= 5: A += 1
        elif a_ == 'sunder' and 'A' in f and y_def >= 2: A += 1
        elif a_ == 'streak' and x_gold_dice >= 3: gold += 1
        elif a_ == 'pest' and 'A' in f and y_skull: A += 1
        elif a_ == 'patient' and X.G < Y.G: gold += f.count('G')
        elif a_ == 'rally' and 'A' in f and X.R < Y.R: A += 1
    counter = sum(1 for i, f in enumerate(X.res) if 'D' in f and ab(X, i) == 'counter')
    sf = sum(1 for i in range(len(X.res)) if ab(X, i) == 'standfast'
             and (not RULES['standfast_cond'] or 'D' in X.res[i]))
    return A, U, D, S, H, gold, steal, counter, sf, push


STRIP_PRIORITY = {'counter': 3, 'standfast': 3, 'formation': 2, 'divine': 1}


def strip_dice(X, Y):
    """'stripdie' mode: each ☣ on X poisons one Y die showing 🛡 (all its shields
    are cancelled). Returns (copy of Y with those shields removed, leftover ☣)."""
    epi = any(ab(X, i) == 'epidemic' and 'P' in f for i, f in enumerate(X.res))
    Px = sum(f.count('P') * (2 if epi and ab(X, i) != 'epidemic' else 1) for i, f in list(enumerate(X.res)) + X.extra)
    Px = max(0, Px - sum(1 for i, f in enumerate(Y.res) if ab(Y, i) == 'antidote' and 'H' in f))   # Antidote
    if not Px:
        return Y, 0
    cands = [i for i, f in enumerate(Y.res) if 'D' in f and ab(Y, i) != 'nightwatch']   # Night Watch
    cands.sort(key=lambda i: (Y.res[i].count('D'), STRIP_PRIORITY.get(ab(Y, i), 0)), reverse=True)
    Y2 = Y.copy()
    hit = cands[:Px]
    for i in hit:
        Y2.res[i] = Y2.res[i].replace('D', '') or '-'
    Y2.extra = [(i, f.replace('D', '') if i in hit else f) for i, f in Y2.extra]
    return Y2, Px - len(hit)


_RND = [0]
def outcome(X, Y, detail=False, rnd=None):
    _RND[0] = rnd or 0
    if RULES['poison'] == 'stripdie':
        Y2, lx_ = strip_dice(X, Y)
        X2, ly_ = strip_dice(Y, X)
        X, Y = X2, Y2
        extra_ax, extra_ay = lx_, ly_
    else:
        extra_ax = extra_ay = 0
    Ax, Ux, Dx, Sx, Hx, gx, stx, cx, sfx, px = totals(X, Y)
    Ay, Uy, Dy, Sy, Hy, gy, sty, cy, sfy, py = totals(Y, X)
    Px = sum(f.count('P') for _, f in list(enumerate(X.res)) + X.extra)
    Py = sum(f.count('P') for _, f in list(enumerate(Y.res)) + Y.extra)
    if RULES['poison'] == 'stripdie':
        Ax += extra_ax; Ay += extra_ay
    if RULES['poison'] == 'corrode2':
        rx, ry = min(Py, Dx), min(Px, Dy)
        Dx -= rx; Dy -= ry
        Ax += Px - ry; Ay += Py - rx
    if RULES['poison'] == 'corrode':
        if RULES['antidote']:
            # spend ♥ to cancel ☣ only where it saves a shield that was needed
            need_x = max(0, min(Dx, Ay) - max(0, Dx - Py)); cx_ = min(Hx, Py, need_x)
            need_y = max(0, min(Dy, Ax) - max(0, Dy - Px)); cy_ = min(Hy, Px, need_y)
            Py -= cx_; Hx -= cx_; Px -= cy_; Hy -= cy_
        Dx, Dy = max(0, Dx - Py), max(0, Dy - Px)
    cm = RULES['counter_min']
    cnt_x = cx if min(Ay, Dx) >= cm else 0
    cnt_y = cy if min(Ax, Dy) >= cm else 0
    atk_to_y = max(0, Ax - Dy) + Ux + X.vbonus
    atk_to_x = max(0, Ay - Dx) + Uy + Y.vbonus
    lx = max(0, atk_to_x + cnt_y + Sx + py - sfx)
    ly = max(0, atk_to_y + cnt_x + Sy + px - sfy)
    sx, sy = min(stx, Y.G), min(sty, X.G)
    Gx = X.G - sy + gx + stx
    Gy = Y.G - sx + gy + sty
    lvx = sum(1 for i in range(len(X.res)) if ab(X, i) == 'levy') if Y.G > X.G else 0
    lvy = sum(1 for i in range(len(Y.res)) if ab(Y, i) == 'levy') if X.G > Y.G else 0
    lvx = min(lvx, max(0, Gy)); Gx += lvx; Gy -= lvx
    lvy = min(lvy, max(0, Gx)); Gy += lvy; Gx -= lvy
    # Poison: ☣ faces give the opponent tokens (cap); each ♥ first removes a token;
    # then each remaining token deals 1 unblockable damage that ignores reductions.
    cap_p = RULES['poison_cap'] if RULES['poison'] == 'dot' else 0
    tx, ty = min(cap_p, X.poison + Py), min(cap_p, Y.poison + Px)
    cl_x, cl_y = min(Hx, tx), min(Hy, ty)
    tx -= cl_x; ty -= cl_y; Hx -= cl_x; Hy -= cl_y
    if RULES['lc_noheal'] and rnd is not None and rnd >= LAST_CALL_ROUND:
        tri = lambda P: sum(f.count('H') for i, f in enumerate(P.res) if ab(P, i) == 'triage' and i not in P.venom)
        Hx, Hy = min(Hx, tri(X)), min(Hy, tri(Y))
    Rx, Ry = X.R - lx + Hx, Y.R - ly + Hy
    cap = RULES['cap']
    if cap is not None:
        Rx, Ry = min(Rx, max(cap, X.R)), min(Ry, max(cap, Y.R))
    Rx -= tx; Ry -= ty
    if detail:
        return dict(Rx=Rx, Ry=Ry, Gx=Gx, Gy=Gy, tx=tx, ty=ty,
                    x=dict(atk=atk_to_y, counter=cnt_x, skull=Sx, heal=Hx, gold=gx + stx,
                           stole=sx, blocked=min(Ay, Dx), standfast=min(sfx, atk_to_x + cnt_y + Sx)),
                    y=dict(atk=atk_to_x, counter=cnt_y, skull=Sy, heal=Hy, gold=gy + sty,
                           stole=sy, blocked=min(Ax, Dy), standfast=min(sfy, atk_to_y + cnt_x + Sy)))
    return Rx, Ry, Gx, Gy


def value(M, O, rnd):
    """Score of the current table from M's point of view (zero-sum)."""
    Rm, Ro, Gm, Go = outcome(M, O, rnd=rnd)
    lc = max(0, rnd - LAST_CALL_ROUND + 1)
    Rm -= lc; Ro -= lc
    if Ro <= 0 and Rm > 0:
        return 100 + Rm
    if Rm <= 0 and Ro > 0:
        return -100 - Ro
    if Rm <= 0 and Ro <= 0:
        if RULES['dko'] == 'higher' and Rm != Ro:
            return 100 if Rm > Ro else -100
        return 0
    # Share-of-Resolve score: a trailing player values survival more and the
    # leader values pressing the kill. Scaled so 1 Resolve = 1 point at parity.
    return 40 * Rm / (Rm + Ro) + GOLD_VALUE * (Gm - Go)


# ------------------------------------------------------------------------- AI
class Action:
    __slots__ = ('kind', 'gain', 'args')

    def __init__(self, kind, gain, **args):
        self.kind, self.gain, self.args = kind, gain, args


def face_values(M, O, i, rnd, mine=True, cost=0, extra=False):
    """Value of each face for die i (of M if mine else of O)."""
    vals = []
    for f in (FACES[M.dice[i]] if mine else FACES[O.dice[i]]):
        m, o = M.copy(), O.copy()
        m.G -= cost
        tgt = m if mine else o
        if extra:
            tgt.extra.append((i, f))
        else:
            tgt.res[i] = f
        vals.append(value(m, o, rnd))
    return vals


def would_ward(M, O, after_value, paid_value):
    """Defender O Wards if the attack costs them more than one Gold is worth."""
    return O.G >= 1 and (after_value - paid_value) > GOLD_VALUE + 1e-9


def candidate_actions(M, O, rnd):
    v0 = value(M, O, rnd)
    acts = []
    n = len(M.dice)
    free = omen_free(M)

    # --- own rerolls (Reroll / Focus / Mulligan) --------------------------------
    reroll_gain = {}
    for i in range(n):
        cost = 0 if free > 0 and (not RULES['omen_self'] or ab(M, i) == 'omen') else 1
        if M.G >= cost:
            vals = face_values(M, O, i, rnd, cost=cost)
            ev = sum(vals) / 6
            acts.append(Action('reroll', ev - v0, i=i, free=(cost == 0)))
            reroll_gain[i] = ev - v0
        if M.G >= 2:
            vals = face_values(M, O, i, rnd, cost=2)
            ev = sum(max(a, b) for a in vals for b in vals) / 36
            acts.append(Action('focus', ev - v0, i=i))
    if M.G >= 2:
        raw = {}
        for i in range(n):
            vals = face_values(M, O, i, rnd)
            raw[i] = sum(vals) / 6 - value(M, O, rnd)
        pick = [i for i in sorted(raw, key=raw.get, reverse=True)[:3] if raw[i] > 0]
        if len(pick) >= 2:
            tot = 0.0
            pools = [FACES[M.dice[i]] for i in pick]
            for combo in itertools.product(*pools):
                m = M.copy(); m.G -= 2
                for i, f in zip(pick, combo):
                    m.res[i] = f
                tot += value(m, O, rnd)
            ev = tot / (6 ** len(pick))
            acts.append(Action('mulligan', ev - v0, dice=pick))

    # --- interfere with opponent (Distract / Jam), anticipating Ward -----------
    if M.G >= 1:
        m_paid = M.copy(); m_paid.G -= 1
        v_paid = value(m_paid, O, rnd)
        for j in range(len(O.dice)):
            if ab(O, j) == 'stubborn':
                continue
            vals = face_values(M, O, j, rnd, mine=False, cost=1)
            ev = sum(vals) / 6
            if would_ward(M, O, ev, v_paid):
                o2 = O.copy(); o2.G -= 1
                ev = value(m_paid, o2, rnd)
            acts.append(Action('distract', ev - v0, j=j))
    if M.G >= 2:
        m_paid = M.copy(); m_paid.G -= 2
        v_paid = value(m_paid, O, rnd)
        for j in range(len(O.dice)):
            if ab(O, j) is None:
                continue
            o2 = O.copy()
            if ab(O, j) == 'relentless' and j not in O.rel:
                o2.rel.add(j)
            else:
                o2.jam.add(j)
            ev = value(m_paid, o2, rnd)
            if would_ward(M, O, ev, v_paid):
                o3 = O.copy(); o3.G -= 1
                ev = value(m_paid, o3, rnd)
            acts.append(Action('jam', ev - v0, j=j))

    # --- die abilities ----------------------------------------------------------
    for i in range(n):
        a = ab(M, i)
        f = M.res[i]
        if a == 'surge' and 'A' in f and i not in M.surge and M.G >= 1:
            m = M.copy(); m.G -= 1; m.surge.add(i)
            acts.append(Action('surge', value(m, O, rnd) - v0, i=i))
        elif a == 'divine' and 'D' in f and (i, 'divine') not in M.used and M.G >= 1:
            m = M.copy(); m.G -= 1; m.divine += 1; m.used.add((i, 'divine'))
            acts.append(Action('divine', value(m, O, rnd) - v0, i=i))
        elif a in ('transmute', 'wildshape', 'bargain', 'inspiration'):
            if a in ('wildshape', 'inspiration'):
                if (i, a) in M.used: continue
                if RULES['flex'] == 'match' and (i, a) in M.gused: continue
                if RULES['flex'] == 'gold' and M.G < 1: continue
            if a == 'transmute' and M.G < 1: continue
            if a == 'bargain' and M.R <= 1: continue
            opts = set(FACES[M.dice[i]]) if a != 'inspiration' else {M.res[j] for j in range(n) if j != i}
            opts.discard(f)
            best, bf = -1e9, None
            for nf in opts:
                m = M.copy(); m.res[i] = nf
                if a == 'transmute' or (a in ('wildshape', 'inspiration') and RULES['flex'] == 'gold'): m.G -= 1
                if a == 'bargain': m.R -= 1
                v = value(m, O, rnd)
                if v > best: best, bf = v, nf
            if bf is not None:
                acts.append(Action(a, best - v0, i=i, face=bf))
        elif a == 'sneaky' and RULES['sneaky'] == 'dirty' and 'S' in f and i not in M.sneak and M.G >= 1:
            m = M.copy(); m.G -= 1; m.sneak.add(i)
            ev = value(m, O, rnd)
            m_paid = M.copy(); m_paid.G -= 1
            if would_ward(M, O, ev, value(m_paid, O, rnd)):
                o2 = O.copy(); o2.G -= 1
                ev = value(m_paid, o2, rnd)
            acts.append(Action('sneaky', ev - v0, i=i))
        elif a == 'loan' and (i, a) not in M.used and M.R > 2:
            m = M.copy(); m.G += 2; m.R -= 1; m.used.add((i, a))
            acts.append(Action('loan', value(m, O, rnd) - v0, i=i))
        elif a == 'strings' and (i, a) not in M.used and M.G >= 2:
            best, bj, bf = -1e9, None, None
            for j in range(n):
                if j == i: continue
                for nf in set(FACES[M.dice[j]]) - {M.res[j]}:
                    m = M.copy(); m.G -= 2; m.used.add((i, a)); m.res[j] = nf
                    v = value(m, O, rnd)
                    if v > best: best, bj, bf = v, j, nf
            if bj is not None:
                acts.append(Action('strings', best - v0, i=i, j=bj, face=bf))
        elif a == 'coat' and (i, a) not in M.used and M.G >= 1:
            for j in range(n):
                if j != i and 'A' in M.res[j]:
                    m = M.copy(); m.G -= 1; m.used.add((i, a)); m.res[j] = M.res[j] + 'P'
                    acts.append(Action('coat', value(m, O, rnd) - v0, i=i, j=j))
        elif a == 'envenom' and (i, a) not in M.used and M.G >= RULES['envenom_cost']:
            m_paid = M.copy(); m_paid.G -= RULES['envenom_cost']; m_paid.used.add((i, a))
            v_paid = value(m_paid, O, rnd)
            for j in range(len(O.dice)):
                if 'H' in O.res[j] and j not in O.venom:
                    o2 = O.copy(); o2.venom.add(j)
                    ev = value(m_paid, o2, rnd)
                    if would_ward(M, O, ev, v_paid):
                        o3 = O.copy(); o3.G -= 1
                        ev = value(m_paid, o3, rnd)
                    acts.append(Action('envenom', ev - v0, i=i, j=j))
        elif a == 'trickster' and (i, a) not in M.used:
            best, pair = -1e9, None
            for x, y in itertools.combinations(range(n), 2):
                if M.res[x] == M.res[y]: continue
                m = M.copy(); m.res[x], m.res[y] = m.res[y], m.res[x]
                v = value(m, O, rnd)
                if v > best: best, pair = v, (x, y)
            if pair:
                acts.append(Action('trickster', best - v0, i=i, pair=pair))
        elif a == 'blessing' and 'H' in f:
            for j in range(n):
                if j != i and 'S' in M.res[j]:
                    m = M.copy()
                    m.res[i] = f.replace('H', '', 1)
                    m.res[j] = M.res[j].replace('S', '', 1)
                    acts.append(Action('blessing', value(m, O, rnd) - v0, i=i, j=j))
        elif a == 'highroller' and (i, a) not in M.used:
            vals = face_values(M, O, i, rnd, extra=True)
            acts.append(Action('highroller', sum(vals) / 6 - v0, i=i))
    return acts


def roll(name, rng):
    return rng.choice(FACES[name])


class Game:
    def __init__(self, a, b, rng, log=False, bench=((), ()), first_active=0, swap_start=False):
        self.P = [Player('A', a), Player('B', b)]
        self.first_active = first_active
        self.active = first_active
        self.swap_start = swap_start
        self.bench = [list(bench[0]), list(bench[1])]
        self.swapped = [False, False]
        self.swapped_n = [0, 0]
        self.rng = rng
        self.log = log
        self.rnd = 0
        self.stats = Counter()
        self.acts = Counter()

    def say(self, *x):
        if self.log:
            print(*x)

    def desc(self, p):
        out = []
        for i, d in enumerate(p.dice):
            s = f'{d} {fs(p.res[i])}'
            if i in p.jam: s += '(jammed)'
            out.append(s)
        for i, f in p.extra:
            out.append(f'{p.dice[i]}+ {fs(f)}')
        return ', '.join(out)

    def apply(self, M, O, act):
        rng, k, a = self.rng, act.kind, act.args
        self.acts[k] += 1
        self.stats[f'{M.name}_act_{k}'] += 1
        if k == 'reroll':
            if a['free']: M.omen_used += 1
            else: M.G -= 1
            old = M.res[a['i']]; M.res[a['i']] = roll(M.dice[a['i']], rng)
            self.say(f"  {M.name}: {'Omen free ' if a['free'] else ''}Reroll {M.dice[a['i']]} {fs(old)}→{fs(M.res[a['i']])}")
        elif k == 'focus':
            M.G -= 2
            i = a['i']; r1, r2 = roll(M.dice[i], rng), roll(M.dice[i], rng)
            best = max((r1, r2), key=lambda f: self._v_with(M, O, i, f))
            M.res[i] = best
            self.say(f"  {M.name}: Focus {M.dice[i]} rolls {fs(r1)} {fs(r2)} keeps {fs(best)}")
        elif k == 'mulligan':
            M.G -= 2
            for i in a['dice']:
                M.res[i] = roll(M.dice[i], rng)
            self.say(f"  {M.name}: Mulligan → " + ', '.join(f'{M.dice[i]} {fs(M.res[i])}' for i in a['dice']))
        elif k in ('distract', 'jam'):
            cost = 1 if k == 'distract' else 2
            M.G -= cost
            j = a['j']
            # defender decides on Ward with the true state
            if k == 'distract':
                m_paid = M
                vals = face_values(M, O, j, self.rnd, mine=False)
                ev = sum(vals) / 6
            else:
                o2 = O.copy()
                if ab(O, j) == 'relentless' and j not in O.rel: o2.rel.add(j)
                else: o2.jam.add(j)
                ev = value(M, o2, self.rnd)
            if would_ward(M, O, ev, value(M, O, self.rnd)):
                O.G -= 1
                self.acts['ward'] += 1; self.stats[f'{O.name}_act_ward'] += 1
                self.say(f"  {M.name}: {k.title()} {O.dice[j]} — {O.name} Wards (1 Gold)")
                return
            if k == 'distract':
                old = O.res[j]; O.res[j] = roll(O.dice[j], rng)
                self.say(f"  {M.name}: Distract {O.name}'s {O.dice[j]} {fs(old)}→{fs(O.res[j])}")
            else:
                if ab(O, j) == 'relentless' and j not in O.rel:
                    O.rel.add(j)
                    self.say(f"  {M.name}: Jam {O.dice[j]} — Relentless ignores it")
                else:
                    O.jam.add(j)
                    if j in O.surge: O.surge.discard(j)
                    self.say(f"  {M.name}: Jam {O.name}'s {O.dice[j]}")
        elif k == 'sneaky':
            M.G -= 1
            m = M.copy(); m.sneak.add(a['i'])
            if would_ward(M, O, value(m, O, self.rnd), value(M, O, self.rnd)):
                O.G -= 1; self.acts['ward'] += 1
                self.say(f"  {M.name}: Sneaky — {O.name} Wards (1 Gold)")
            else:
                M.sneak.add(a['i'])
                self.say(f"  {M.name}: Sneaky — Goblin's ☠ hits {O.name} instead")
        elif k == 'envenom':
            M.G -= RULES['envenom_cost']; M.used.add((a['i'], 'envenom')); j = a['j']
            o2 = O.copy(); o2.venom.add(j)
            if would_ward(M, O, value(M, o2, self.rnd), value(M, O, self.rnd)):
                O.G -= 1; self.acts['ward'] += 1
                self.say(f"  {M.name}: Envenom {O.dice[j]} — {O.name} Wards (1 Gold)")
            else:
                O.venom.add(j)
                self.say(f"  {M.name}: Envenom — {O.name}'s {O.dice[j]} heals nothing this round")
        elif k == 'loan':
            M.G += 2; M.R -= 1; M.used.add((a['i'], 'loan'))
            self.say(f"  {M.name}: Loan (+2 Gold, −1 Resolve)")
        elif k == 'strings':
            M.G -= 2; M.used.add((a['i'], 'strings')); M.res[a['j']] = a['face']
            self.say(f"  {M.name}: Strings sets {M.dice[a['j']]} to {fs(a['face'])}")
        elif k == 'coat':
            M.G -= 1; M.used.add((a['i'], 'coat')); M.res[a['j']] += 'P'
            self.say(f"  {M.name}: Toxin Coat on {M.dice[a['j']]}")
        elif k == 'surge':
            M.G -= 1; M.surge.add(a['i'])
            self.say(f"  {M.name}: Arcane Surge ({M.dice[a['i']]}) — its ⚔ unblockable")
        elif k == 'divine':
            M.G -= 1; M.divine += 1; M.used.add((a['i'], 'divine'))
            self.say(f"  {M.name}: Divine Protection (+1 block)")
        elif k in ('transmute', 'wildshape', 'bargain', 'inspiration'):
            i = a['i']; old = M.res[i]; M.res[i] = a['face']
            if k == 'transmute': M.G -= 1
            if k == 'bargain': M.R -= 1; self.stats[f'{M.name}_bargain_loss'] += 1
            if k in ('wildshape', 'inspiration'):
                M.used.add((i, k)); M.gused.add((i, k))
                if RULES['flex'] == 'gold': M.G -= 1
            self.say(f"  {M.name}: {k.title()} {M.dice[i]} {fs(old)}→{fs(a['face'])}")
        elif k == 'trickster':
            x, y = a['pair']; M.used.add((a['i'], 'trickster'))
            M.res[x], M.res[y] = M.res[y], M.res[x]
            self.say(f"  {M.name}: Trickster swaps {M.dice[x]}↔{M.dice[y]}")
        elif k == 'blessing':
            i, j = a['i'], a['j']
            M.res[i] = M.res[i].replace('H', '', 1); M.res[j] = M.res[j].replace('S', '', 1)
            self.say(f"  {M.name}: Blessing cancels ☠ on {M.dice[j]}")
        elif k == 'highroller':
            i = a['i']; M.used.add((i, 'highroller'))
            f = roll(M.dice[i], rng); M.extra.append((i, f))
            self.say(f"  {M.name}: High Roller second roll {fs(f)}")

    def _v_with(self, M, O, i, f):
        m = M.copy(); m.res[i] = f
        return value(m, O, self.rnd)

    def loadout_score(self, me, opp, n=60, seed=0):
        rng = random.Random(seed)          # common random numbers across candidates
        tot = 0.0
        for _ in range(n):
            m, o = me.copy(), opp.copy()
            m.new_round(); o.new_round()
            for p in (m, o):
                pres = {ABIL[d] for d in p.dice if ABIL[d] not in (None, 'imitate')}
                p.mimic = next((x for x in MIMIC_PRIORITY if x in pres), None)
                p.res = [roll(d, rng) for d in p.dice]
            tot += value(m, o, self.rnd)
        return tot / n

    def tavern_swap(self):
        self.swapped_n = [0, 0]
        for _ in range(RULES['swap_n']):
            self._swap_once()

    def _swap_once(self):
        for k, p in enumerate(self.P):
            if self.swapped[k] or not self.bench[k]:
                continue
            o = self.P[1 - k]
            sd = self.rng.randrange(1 << 30)
            base = self.loadout_score(p, o, seed=sd)
            best, choice = base, None
            for i in range(len(p.dice)):
                for b in self.bench[k]:
                    q = p.copy(); q.dice = p.dice[:]; q.dice[i] = b
                    v = self.loadout_score(q, o, seed=sd)
                    if v > best:
                        best, choice = v, (i, b)
            if choice and best - base > 0.5:
                i, b = choice
                old = p.dice[i]
                p.dice = p.dice[:]; p.dice[i] = b
                self.bench[k].remove(b); self.bench[k].append(old)
                self.swapped_n[k] += 1
                if self.swapped_n[k] >= RULES['swap_n']:
                    self.swapped[k] = True
                self.stats['swaps'] += 1
                self.say(f'  {p.name}: Tavern Swap {old} → {b}')

    def play_round(self):
        self.rnd += 1
        if RULES['format'] == 'match':
            self.active = self.first_active if self.rnd % 2 == 1 else 1 - self.first_active
            if RULES['swap'] and self.swap_start and self.rnd == 1:
                self.tavern_swap()
        elif RULES['swap'] and self.rnd >= 2:
            self.tavern_swap()
        A, B = self.P
        for p in self.P:
            p.new_round()
            pres = {ABIL[d] for j, d in enumerate(p.dice) if ABIL[d] not in (None, 'imitate')}
            for x in MIMIC_PRIORITY:
                if x in pres:
                    p.mimic = x; break
            p.res = [roll(d, self.rng) for d in p.dice]
        self.say(f'\n— Round {self.rnd} —  A: {A.R}R {A.G}G   B: {B.R}R {B.G}G')
        self.say(f'  A rolls: {self.desc(A)}')
        self.say(f'  B rolls: {self.desc(B)}')
        # action window
        order = ([A, B] if self.active == 0 else [B, A]) if RULES['format'] == 'match' else ([A, B] if self.rnd % 2 else [B, A])
        FORTUNE = {'reroll', 'focus', 'mulligan', 'distract'}
        GOLD_AB = {'wildshape', 'inspiration', 'transmute', 'surge', 'divine', 'sneaky', 'envenom', 'coat', 'strings'}
        COSTS = {'reroll': 1, 'focus': 2, 'mulligan': 2, 'distract': 1}
        def reserve(P):   # Gold a sensible player keeps for the Tactics step
            return min(2, sum(1 for i in range(len(P.dice)) if ab(P, i) in GOLD_AB))
        steps_def = [lambda k: k in FORTUNE, lambda k: k not in FORTUNE] if RULES['two_step'] else [lambda k: True]
        for allowed in steps_def:
            passes, steps, t = 0, 0, 0
            while passes < 2 and steps < 60:
                M, O = order[t % 2], order[(t + 1) % 2]
                acts = [x for x in candidate_actions(M, O, self.rnd) if allowed(x.kind)]
                if RULES['two_step'] and allowed('reroll'):   # Fortune: respect the reserve
                    acts = [x for x in acts if x.kind not in COSTS or (x.kind == 'reroll' and x.args.get('free')) or M.G - COSTS[x.kind] >= reserve(M)]
                best = max(acts, key=lambda x: x.gain, default=None)
                if best and best.gain > MIN_GAIN:
                    self.apply(M, O, best); passes = 0
                else:
                    passes += 1
                t += 1; steps += 1
        # resolution: Volatile rolls first
        for p in self.P:
            for i in range(len(p.dice)):
                if ab(p, i) == 'volatile':
                    f = roll(p.dice[i], self.rng)
                    p.extra.append((i, f))
                    if f == p.res[i]:
                        p.vbonus += 1
                    self.say(f'  {p.name}: Volatile reroll {fs(f)}' + (' — match! +1' if f == p.res[i] else ''))
        d = outcome(A, B, detail=True, rnd=self.rnd)
        for side, p in (('x', A), ('y', B)):
            s = d[side]
            self.stats[f'{p.name}_dmg_atk'] += s['atk']
            self.stats[f'{p.name}_dmg_counter'] += s['counter']
            self.stats[f'{p.name}_self_skull'] += s['skull']
            self.stats[f'{p.name}_heal'] += s['heal']
            self.stats[f'{p.name}_gold'] += s['gold']
        A.R, B.R, A.G, B.G = d['Rx'], d['Ry'], d['Gx'], d['Gy']
        A.poison, B.poison = d['tx'], d['ty']
        self.stats['A_poison_dmg'] += d['tx']; self.stats['B_poison_dmg'] += d['ty']
        lc = max(0, self.rnd - LAST_CALL_ROUND + 1)
        if lc:
            A.R -= lc; B.R -= lc
            self.stats['lastcall'] += 1
        self.say(f"  Resolve: A dealt {d['x']['atk']}+{d['x']['counter']}ctr, took {d['x']['skull']}☠, healed {d['x']['heal']} | "
                 f"B dealt {d['y']['atk']}+{d['y']['counter']}ctr, took {d['y']['skull']}☠, healed {d['y']['heal']}"
                 + (f' | Last Call −{lc}' if lc else ''))
        self.say(f'  → A: {A.R}R {A.G}G   B: {B.R}R {B.G}G')

    def sudden_death(self):
        self.stats['sudden_death'] += 1
        while True:
            a = sum(roll(d, self.rng).count('A') for d in self.P[0].dice)
            b = sum(roll(d, self.rng).count('A') for d in self.P[1].dice)
            self.say(f'  Sudden death: A {a}⚔  B {b}⚔')
            if a != b:
                return 0 if a > b else 1

    def play(self):
        A, B = self.P
        while self.rnd < MAX_ROUNDS:
            self.play_round()
            if A.R <= 0 and B.R <= 0:
                self.stats['double_ko'] += 1
                if RULES['format'] == 'match':
                    return self.active
                if RULES['dko'] == 'higher' and A.R != B.R:
                    return 0 if A.R > B.R else 1
                return self.sudden_death()
            if A.R <= 0: return 1
            if B.R <= 0: return 0
        self.stats['timeout'] += 1
        return 0 if A.R > B.R else 1 if B.R > A.R else self.rng.randint(0, 1)


# ------------------------------------------------------------------ experiments
def run_match(a, b, seed, bench):
    """v0.6 match: best of 3 rounds; first active random, then the loser of a round
    starts the next round active; Resolve/Gold reset; Tavern Swap allowed before rounds 2-3."""
    rng = random.Random(seed)
    first = rng.randint(0, 1)
    wins = [0, 0]; la, lb = list(a), list(b); ba, bb = list(bench[0]), list(bench[1])
    turns = 0; stats = Counter(); acts = Counter(); rnum = 0
    while max(wins) < 2:
        g = Game(la, lb, rng, bench=(ba, bb), first_active=first, swap_start=rnum > 0)
        w = g.play()
        turns += g.rnd; stats.update(g.stats); acts.update(g.acts)
        stats['rounds'] += 1; stats['first_active_won'] += (w == first)
        la, lb = g.P[0].dice, g.P[1].dice; ba, bb = g.bench
        wins[w] += 1; first = 1 - w; rnum += 1
    stats['comeback'] += (rnum == 3)
    return (0 if wins[0] == 2 else 1), turns, dict(stats), dict(acts)


def run_game(args):
    a, b, seed = args[:3]
    bench = args[3] if len(args) > 3 else ((), ())
    if RULES['format'] == 'match':
        return run_match(a, b, seed, bench)
    rng = random.Random(seed)
    g = Game(a, b, rng, bench=bench)
    w = g.play()
    return w, g.rnd, dict(g.stats), dict(g.acts)


def pmap(fn, items, procs):
    if procs <= 1:
        return list(map(fn, items))
    from multiprocessing import Pool
    with Pool(procs) as pool:
        return pool.map(fn, items, chunksize=max(1, len(items) // (procs * 8)))


def field(games, seed, procs, size=5, bench_n=3):
    rng = random.Random(seed)
    names = list(FACES)
    jobs = []
    for _ in range(games):
        x, y = rng.sample(names, size + bench_n), rng.sample(names, size + bench_n)
        jobs.append((x[:size], y[:size], rng.randrange(1 << 30), (x[size:], y[size:])))
    res = pmap(run_game, jobs, procs)
    wins, plays = Counter(), Counter()
    rounds = []
    agg, acts = Counter(), Counter()
    for (a, b, *_), (w, r, st, ac) in zip(jobs, res):
        rounds.append(r)
        for d in a: plays[d] += 1; wins[d] += (w == 0)
        for d in b: plays[d] += 1; wins[d] += (w == 1)
        agg.update(st); acts.update(ac)
    return wins, plays, rounds, agg, acts, len(jobs)


def versus(a, b, games, seed, procs, bench_n=3):
    rng = random.Random(seed)
    jobs = []
    names = list(FACES)
    for k in range(games):         # alternate seats; each side gets a random 3-die bench
        ba = rng.sample([d for d in names if d not in a], bench_n)
        bb = rng.sample([d for d in names if d not in b], bench_n)
        sd = rng.randrange(1 << 30)
        jobs.append((a, b, sd, (ba, bb)) if k % 2 == 0 else (b, a, sd, (bb, ba)))
    res = pmap(run_game, jobs, procs)
    awin = 0; rounds = []
    for k, (w, r, st, ac) in enumerate(res):
        rounds.append(r)
        awin += (w == 0) if k % 2 == 0 else (w == 1)
    return awin / games, rounds


def pct(xs, q):
    s = sorted(xs); return s[min(len(s) - 1, int(q * len(s)))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mode', choices=['match', 'field', 'vs'])
    ap.add_argument('--a'); ap.add_argument('--b')
    ap.add_argument('--games', type=int, default=2000)
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--procs', type=int, default=2)
    ap.add_argument('-v', action='store_true')
    ap.add_argument('--no-counter', action='store_true')
    ap.add_argument('--no-omen', action='store_true')
    o = ap.parse_args()
    RULES['counter'] = not o.no_counter
    RULES['omen'] = not o.no_omen
    if o.mode == 'match':
        g = Game(o.a.split(','), o.b.split(','), random.Random(o.seed), log=True)
        w = g.play()
        print(f"\nWinner: {'A' if w == 0 else 'B'} after {g.rnd} rounds")
    elif o.mode == 'vs':
        wr, rounds = versus(o.a.split(','), o.b.split(','), o.games, o.seed, o.procs)
        print(f'A win rate {wr:.3f}  median rounds {pct(rounds, .5)}  p90 {pct(rounds, .9)}')
    else:
        wins, plays, rounds, agg, acts, n = field(o.games, o.seed, o.procs)
        print(f'{n} games, median {pct(rounds, .5)} rounds, p90 {pct(rounds, .9)}, max {max(rounds)}')
        for d in sorted(plays, key=lambda d: -wins[d] / plays[d]):
            p = wins[d] / plays[d]; se = math.sqrt(p * (1 - p) / plays[d])
            print(f'  {d:10s} {p:.3f} ±{1.96 * se:.3f}  (n={plays[d]})')
        print('actions per game:', {k: round(v / n, 2) for k, v in acts.most_common()})
        print('lastcall rounds/game', agg['lastcall'] / n, 'sudden death', agg['sudden_death'], 'timeouts', agg['timeout'])


if __name__ == '__main__':
    main()
