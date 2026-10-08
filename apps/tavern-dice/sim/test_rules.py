from tavern_sim import *
import copy as _c
V051=dict(RULES); OLD=_c.deepcopy(FACES)
# legacy checks below use pre-v0.5 rules
RULES.update(standfast_cond=False,counter_min=1,poison='dot',omen_self=False,swap=False)
def mk(dice,res,R=10,G=0):
    p=Player('x',dice); p.res=list(res); p.R=R; p.G=G; return p
# Formation +1 D; Knight counter unblockable; Stand Fast
X=mk(['Soldier','Knight','Guardian'],['D','D','A']); Y=mk(['Monster','Monster','Monster'],['AA','AAA','S'])
Rx,Ry,_,_=outcome(X,Y)
# X D = 2 +1 formation=3; Y A=5 -> 2 dmg; standfast -1 -> 1. X A=1 vs Y D0 ->1; counter 1; Y skull 1 => Y loses 3
assert (Rx,Ry)==(9,7),(Rx,Ry)
# Bloodlust: +1 per skull (blockable); skulls hurt
X=mk(['Berserker','Monster'],['A','S']); Y=mk(['Oracle'],['G'])
assert outcome(X,Y)[:2]==(9,8)
# Precise only when sole ⚔ die; Backstab needs no 🛡 showing
X=mk(['Archer','Assassin'],['A','G']); Y=mk(['Oracle'],['G']); assert outcome(X,Y)[1]==8
X=mk(['Archer','Assassin'],['A','A']); Y=mk(['Oracle'],['G']); assert outcome(X,Y)[1]==7   # 1+ (1+1 backstab)
X=mk(['Assassin'],['AA']); Y=mk(['Oracle'],['D']); assert outcome(X,Y)[1]==9
# Hoard, Pickpocket
X=mk(['Dragon','Thief'],['G','GA']); Y=mk(['Oracle'],['H'],G=3)
Rx,Ry,Gx,Gy=outcome(X,Y); assert (Gx,Gy)==(3,2),(Gx,Gy)
# Surge unblockable
X=mk(['Mage'],['AA']); X.surge.add(0); Y=mk(['Dwarven'],['DD']); assert outcome(X,Y)[1]==8
# Jam disables
X=mk(['Knight'],['D']); Y=mk(['Berserker'],['A']); X.jam.add(0); assert outcome(X,Y)[1]==10
# Mimic copying counter
X=mk(['Knight','Mimic'],['D','D']); X.mimic='counter'; Y=mk(['Berserker'],['A']); assert outcome(X,Y)[1]==8
print('all rule checks pass')
# --- v0.5 candidates
T_R=dict(RULES); RULES['poison']='corrode'
X=mk(['Archer'],['L']); Y=mk(['Dwarven'],['DD']); assert outcome(X,Y)[1]==9          # ⚡ unblockable
FACES['Viper']=EXTRA_DICE['Viper']; ABIL['Viper']=None
X=mk(['Viper','Monster'],['P','AA']); Y=mk(['Dwarven'],['DD']); assert outcome(X,Y)[1]==9   # ☣ strips one 🛡 → 1 ⚔ through
RULES['antidote']=True
Y=mk(['Dwarven','Cleric'],['DD','H']); assert outcome(X,Y)[1]==10, outcome(X,Y)   # ♥ cancels ☣, both ⚔ blocked
RULES.clear(); RULES.update(T_R)
print('v0.5 checks pass')
# --- v0.5b candidates
T_R=dict(RULES)
FACES['Viper2']=EXTRA_DICE['Viper2']; ABIL['Viper2']='envenom'
RULES['poison']='corrode2'
X=mk(['Viper2','Monster'],['P','AA']); Y=mk(['Dwarven'],['DD']); assert outcome(X,Y)[1]==9
X=mk(['Viper2'],['P']); Y=mk(['Oracle'],['G']); assert outcome(X,Y)[1]==9            # leftover ☣ → ⚔
RULES['poison']='stripdie'
X=mk(['Viper2','Monster'],['P','AA']); Y=mk(['Dwarven'],['DD']); assert outcome(X,Y)[1]==8   # whole [🛡🛡] cancelled
X=mk(['Viper2','Monster'],['P','AA']); Y=mk(['Knight','Guardian'],['DD','D'])
assert outcome(X,Y)[1]==10   # Knight stripped: 2⚔ vs 1🛡 → 1, Stand Fast → 0
RULES['standfast_cond']=True
Y=mk(['Knight','Guardian'],['D','DD']); assert outcome(X,Y)[1]==9   # Guardian stripped → no Stand Fast; 2⚔ vs Knight 1🛡 → 1
RULES.clear(); RULES.update(T_R)
# Envenom negates healing
X=mk(['Cleric'],['HH'],R=5); X.venom.add(0); Y=mk(['Oracle'],['G']); assert outcome(X,Y)[0]==5
print('v0.5b checks pass')

# --- v0.5.1 defaults
RULES.clear(); RULES.update(V051)
X=mk(['Viper','Monster'],['P','AA']); Y=mk(['Guardian','Knight'],['DD','D'])
assert outcome(X,Y)[1]==9, outcome(X,Y)  # Guardian poisoned (no Stand Fast), 2⚔ vs Knight 1🛡 → 1; 1 blocked <2 → no Counterattack
print('v0.5.1 checks pass')

# --- Expansion 3 "Tavern Regulars"
RULES.clear(); RULES.update(V051)
o = lambda X, Y: outcome(X, Y, detail=True)
# Doorman: +1 🛡 vs 3+ ⚔
X=mk(['Bouncer'],['D']); Y=mk(['Monster','Basic'],['AA','A']); assert o(X,Y)['Rx']==9    # 3⚔ vs 2🛡
Y=mk(['Monster'],['AA']); assert o(X,Y)['Rx']==9
# Hearty Stew: +1 ♥ at ≤5 Resolve
X=mk(['Cook'],['H'],R=5); Y=mk(['Monster'],['AA']); assert o(X,Y)['Rx']==5     # 2 dmg, 2 ♥ mend it all
X=mk(['Cook'],['H'],R=6); assert o(X,Y)['Rx']==5                                    # no Stew above 5: 1 ♥ mends 1
# Rousing Tune: ♥ gives another ⚔ die +1
X=mk(['Minstrel','Basic'],['H','A']); Y=mk(['Oracle'],['G']); assert o(X,Y)['Ry']==8
# Strong Brew: ♥ → +1 Gold
X=mk(['Brewer'],['H']); assert o(X,Y)['Gx']==1
# Liquid Courage / Rally / Pest Control / Sunder: +1 ⚔
X=mk(['Drunkard'],['A'],R=4); assert o(X,Y)['Ry']==8
X=mk(['Militia'],['A'],R=4); assert o(X,Y)['Ry']==8
X=mk(['Ratcatcher'],['A']); Y=mk(['Monster'],['S']); assert o(X,Y)['Ry']==7   # 2⚔ + own ☠
X=mk(['Smith'],['A']); Y=mk(['Dwarven'],['DD']); assert o(X,Y)['Ry']==10
X=mk(['Smith','Monster'],['A','AA']); assert o(X,Y)['Ry']==8                    # 4⚔ vs 2🛡
# Night Watch: ☣ can't poison it (leftover ☣ becomes ⚔, blocked by the shield)
X=mk(['Viper'],['P']); Y=mk(['Watchman'],['D']); assert o(X,Y)['Ry']==10
# Antidote: ♥ cancels a ☣
Y=mk(['Herbalist','Dwarven'],['H','DD']); X=mk(['Viper','Monster'],['P','AA']); assert o(X,Y)['Ry']==10
# Lucky Streak: 3 dice showing 💰 → +1 Gold;  Patient: behind on Gold → double 💰
X=mk(['Cardsharp','Basic','Peddler'],['G','G','G']); Y=mk(['Oracle'],['D']); assert o(X,Y)['Gx']==4
X=mk(['Fisher'],['G']); Y=mk(['Oracle'],['D']); Y.G=2; assert o(X,Y)['Gx']==2
print('Expansion 3 checks pass')

# --- v0.10: Closing Time + Mend
import tavern_sim as _T
assert RULES['clock']=='flat' and RULES['mend'] and not RULES['mend_clock'] and _T.LAST_CALL_ROUND==10
X=mk(['Cleric'],['HH'],R=7); Y=mk(['Oracle'],['G']); assert o(X,Y)['Rx']==7                 # no damage → ♥ restores nothing
Y=mk(['Monster'],['AA']); assert o(X,Y)['Rx']==7                                             # 2 dmg mended
Y=mk(['Monster'],['AAA']); assert o(X,Y)['Rx']==6                                            # 3 dmg, 2 mended
Y=mk(['Oracle'],['G']); assert outcome(X,Y,detail=True,rnd=10)['Rx']==6                       # Closing Time 1, can't be mended
assert outcome(X,Y,detail=True,rnd=9)['Rx']==7                                               # before turn 10: no clock
X=mk(['Sawbones'],['HH'],R=7); assert outcome(X,Y,detail=True,rnd=11)['Rx']==7               # Triage mends Closing Time
X=mk(['Barkeep'],['GG']); Y=mk(['Oracle'],['G']); assert outcome(X,Y,detail=True,rnd=5)['Ry']==8 and outcome(X,Y,detail=True,rnd=4)['Ry']==10   # Last Orders from turn 5 (v0.10.1)
print('v0.10 checks pass')
