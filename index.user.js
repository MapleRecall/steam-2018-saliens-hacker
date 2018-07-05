// ==UserScript==
// @name            Steam 2018 summer game hacker
// @description     _(:3」∠)_
// @author          MapleRecall
// @namespace       https://github.com/MapleRecall
// @downloadURL     https://raw.githubusercontent.com/MapleRecall/steam-2018-saliens-hacker/master/index.js
//
// @license         MIT License
// @copyright       Copyright (C) 2018, by MapleRecall 
//
// @include         https://steamcommunity.com/saliengame
// @include         https://steamcommunity.com/saliengame/
// @include         https://steamcommunity.com/saliengame/play
// @include         https://steamcommunity.com/saliengame/play/
//
// @version         1.6.8
// @updateURL       https://raw.githubusercontent.com/MapleRecall/steam-2018-saliens-hacker/master/index.js
//
// @run-at          document-start|document-end
// @grant           none
// ==/UserScript==

(async function ($, forSTCN) {
    const gameUrlPrefix = 'https://community.steam-api.com/ITerritoryControlMinigameService'
    const stcnId = 255962
    let token
    let gameTimer
    let errorTime = 0
    let score
    let currentGame
    let running = false
    let $output = $('#dogeOutput')
    let currentZone
    let currentPlanetID
    let fireTarget = null
    let planetList
    let planetTimer
    let inBoss = false
    let bossOveredList = []
    let bossSound = localStorage.getItem('dogeBossSound') === '0' ? false : true

    if ($output.length === 0) {
        let $dogeBody = $('<div>').css({
            boxSizing: 'border-box', position: 'fixed', bottom: 0, left: '20px', right: '20px', zIndex: 999999,
            padding: '10px', borderRadius: '5px 5px 0 0', background: '#171a21', color: '#b8b6b4',
            boxShadow: '0 0 20px #000'
        }).appendTo($('body'))
        $output = $('<div id="dogeOutput">').css({ height: '200px', overflow: 'auto', margin: '0 0 10px' }).appendTo($dogeBody)
        $(`<div class="global_header_toggle_button">`).text('　START　').click(() => { window.superDoge.start() }).appendTo($dogeBody)
        $(`<div class="global_header_toggle_button">`).text('　STOP　').click(() => { window.superDoge.stop() }).appendTo($dogeBody)
        $(`<div class="global_header_toggle_button">`).text('　SOUND　').click(() => { window.superDoge.sound() }).appendTo($dogeBody)
    }

    async function joinGame() {
        clearTimeout(gameTimer)
        log(`==============================================================`)
        errorTime = 0
        try {
            log(`Fetch info...`)
            !planetList && await getPlanetList()
            var { response } = await $.post(`${gameUrlPrefix}/GetPlayerInfo/v0001/`, `access_token=${token}`)
            const { active_planet, level, score: _score, next_level_score, active_zone_game, clan_info } = response
            if (active_zone_game) {
                if (score) {
                    log('Alreay in a game? Try send score...')
                    return sendScore()
                }
                log('Alreay in a game, try to leave...')
                await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${active_zone_game}`)
            }
            score = 0


            if (forSTCN && (!clan_info || clan_info.accountid !== stcnId)) {
                await $.post(`${gameUrlPrefix}/RepresentClan/v0001/`, `clanid=103582791429777370&access_token=${token}`)
            }

            
            let currentPlanet = planetList.find(({ id }) => id === active_planet)
            currentPlanetID = active_planet
            if (!active_planet) {
                log(`Joining planet...`)
                fireTarget = null
                currentPlanetID = planetList[0].id
                await $.post(`${gameUrlPrefix}/JoinPlanet/v0001/`, `id=${currentPlanetID}&access_token=${token}`)
            } else if (fireTarget === null && ((planetList[0].zonesBoss.length > 0 || currentPlanet.zonesD3.length < 3) && active_planet !== planetList[0].id)) {
                log(`Change planet...`)
                await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${active_planet}`)
                currentPlanetID = planetList[0].id
                await $.post(`${gameUrlPrefix}/JoinPlanet/v0001/`, `id=${currentPlanetID}&access_token=${token}`)
            }
            const planet = await getPlanetInfo(currentPlanetID)
            log(`Planet: ${planet.state.name}  Level: ${level}  Exp: ${_score}/${next_level_score}  Team: ${clan_info ? clan_info.name : 'None'}`)
            let zones = planet.zones.filter(({ captured }) => !captured)
            let targetZone = zones.find(({ zone_position }) => zone_position === fireTarget)
            if (targetZone) {
                log(`>>> FIRE ZONE ${fireTarget} <<<`)
            } else if (planet.zonesBoss.length > 0) {
                log(`Joining boss zone...`)
                if (bossSound && $audio[0].paused) {
                    $audio[0].loop = true
                    $audio[0].play()
                }
                var { response } = await $.post(`${gameUrlPrefix}/JoinBossZone/v0001/`, `zone_position=${planet.zonesBoss[0].zone_position}&access_token=${token}`)
                console.log(response)
                currentZone = planet.zonesBoss[0]
                if (Object.keys(response).length === 0) { throw 'Join boss zone failed.' }
                log('Join boss zone success!')
                inBoss = true
                return bossFight()
            } else {
                fireTarget = null
                if (forSTCN && clan_info && clan_info.accountid === stcnId) {
                    targetZone = findTarget(planet)
                } else {
                    zones = sortZones(zones, 2)
                    targetZone = zones.find(({ difficulty }) => difficulty === 3) || zones.find(({ difficulty }) => difficulty === 2) || zones[0]
                }
            }
            currentZone = targetZone
            const { zone_position, difficulty, capture_progress: progress } = targetZone
            score = difficulty === 1 ? 600 : difficulty === 2 ? 1200 : 2400
            log(`Joining zone...`)
            var { response: { zone_info } } = await $.post(`${gameUrlPrefix}/JoinZone/v0001/`, `zone_position=${zone_position}&access_token=${token}`)
            if (zone_info) {
                log(`Join zone ${zone_position}(${zone_position % 12 + 1 | 0},${zone_position / 12 + 1 | 0}) success.`)
                log(`Progress: ${(progress * 100).toFixed(2)}%, wait 110s to send score ${score}...`)
                currentGame = zone_info.gameid
                gameTimer = setTimeout(sendScore, 110000)
            } else {
                throw 'Service reject.'
            }
        } catch (e) {
            console.error(e)
            log(`Join zone fail, wait 2.5s...`)
            gameTimer = setTimeout(joinGame, 2500)
        }
    }

    async function sendScore() {
        clearTimeout(gameTimer)
        log(`Sending score...`)
        try {
            var { response } = await $.post(`${gameUrlPrefix}/ReportScore/v0001/`, `access_token=${token}&score=${score}&language=schinese`)
            if (response['new_score']) {
                log(`Send score success, new score: ${response['new_score']}.`)
                gameTimer = setTimeout(joinGame, 100)
            } else {
                throw 'Service reject.'
            }
        } catch (e) {
            if (errorTime++ < 5) {
                console.error(e)
                log(`Send score fail ${errorTime} times, wait 2s...`)
                gameTimer = setTimeout(sendScore, 2000)
            } else {
                log(`Send score fail ${errorTime - 1} times, reset...`)
                score = 0
                gameTimer = setTimeout(joinGame, 100)
                errorTime = 0
            }
        }
    }


    async function getPlanetInfo(id) {
        let planet
        try {
            const { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanet/v0001/?id=${id}&language=schinese`);
            planet = planets[0]
        } catch (e) {
            console.error(e)
            return getPlanetInfo(id)
        }
        planet.zones = planet.zones.filter(({ captured }) => !captured)
        planet.zonesD3 = planet.zones.filter(({ difficulty, boss_active }) => difficulty === 3 && !boss_active)
        planet.zonesD2 = planet.zones.filter(({ difficulty, boss_active }) => difficulty === 2 && !boss_active)
        planet.zonesD1 = planet.zones.filter(({ difficulty, boss_active }) => difficulty === 1 && !boss_active)
        planet.zonesBoss = planet.zones.filter(({ type, boss_active, zone_position }) => type === 4 && boss_active && !bossOveredList.some(({ pid, zp }) => pid === currentPlanetID && zp === zone_position))
        planet.important = planet.zonesBoss.length * 1000000 + planet.zonesD3.length * 10000 + planet.zonesD2.length * 100 + planet.zonesD1.length
        return planet
    }

    async function getPlanetList() {
        clearTimeout(planetTimer)
        try {
            let { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanets/v0001/?active_only=1&language=schinese`)
            const _planetList = []
            await Promise.all(planets.map(async ({ id }) => _planetList.push(await getPlanetInfo(id))))
            planetList = _planetList.sort((a, b) => b.important - a.important)
            planetTimer = setTimeout(getPlanetList, 180000)
            log(`******************************`)
            log(`*  Plant info`)
            log(`******************************`)
            planetList.forEach(({ state: { name, capture_progress }, zonesD3, zonesD2, zonesD1 }) => log(`*  ${(capture_progress * 100).toFixed(2)}%\tH:${zonesD3.length} M:${zonesD2.length} E:${zonesD1.length}\t${name}`))
            log(`******************************`)
            if (!inBoss && planetList[0].zonesBoss.length > 0) {
                stop(true)
            }
            return planetList
        } catch (e) {
            console.log(e)
            planetTimer = setTimeout(getPlanetList, 2000)
        }
    }

    function sortZones(zones, type = 0) {
        switch (type) {
            case 0: return zones.sort(({ capture_progress: a }, { capture_progress: b }) => b - a)
            case 1: return zones.sort(({ capture_progress: a }, { capture_progress: b }) => a - b)
            case 2: return zones.sort(({ zone_position: a }, { zone_position: b }) => Math.abs(48 - a) - Math.abs(48 - b))
        }
    }

    function getLeaderZone(zones, min = 1, k = 0) {
        for (let i = 0; i < min; i++) {
            let target = zones.find(({ top_clans, capture_progress }) => top_clans && (capture_progress < 1 / (i * k + 1)) && top_clans[i] && top_clans[i].accountid === stcnId)
            if (target) {
                return target
            }
        }
    }

    function findTarget({ zonesD3, zonesD2, zonesD1 }) {
        let target
        if (zonesD3.length > 0) {
            target = getLeaderZone(zonesD3, 2, 2) || sortZones(zonesD3, 2)[0]
            return target
        } else if (zonesD2.length > 0) {
            target = getLeaderZone(zonesD3, 2, 2) || sortZones(zonesD2, 2)[0]
            return target
        }
        else {
            target = getLeaderZone(zonesD1, 3, 1) || sortZones(zonesD1, 2)[0]
            return target
        }
    }

    async function fire(x, y) {
        fireTarget = 12 * (y - 1) + (x - 1)
        log(`>>> SET TARGET: ZONE ${fireTarget} <<<`)
        if (fire !== currentZone.zone_position) {
            log(`Restart to change target...`)
            await stop()
            start()
        }
    }

    function endFire() {
        log(`>>> CANCLE TARGET: ZONE ${fireTarget} <<<`)
        fireTarget = null
    }

    let $audio = $('#dogeAudio')
    if ($audio.length === 0) {
        $audio = $('<audio src="https://steamcdn-a.akamaihd.net/steamcommunity/public/assets/saliengame/sfx/SS2018_Saliens_Intro2.ogg?v=1550bld">').appendTo($('body'))
        $audio[0].volume = .5
    }

    let healTime = 0
    async function bossFight() {
        clearTimeout(gameTimer)
        await new Promise((resolve) => { gameTimer = setTimeout(resolve, 4000) })
        let use_heal_ability = 0, damage_to_boss = 0, damage_taken = 0
        if (healTime) {
            if (Date.now() > healTime) {
                use_heal_ability = 1
                log('Using heal ability, but why?')
                healTime = Date.now() + 120000
            }
            damage_to_boss = 20 + Math.random() * 100 | 0
        } else {
            healTime = Date.now() + 120000 + Math.random(60) | 0
        }
        try {
            var { response } = await $.post(`${gameUrlPrefix}/ReportBossDamage/v0001/`, `access_token=${token}&use_heal_ability=${use_heal_ability}&damage_to_boss=${damage_to_boss}&damage_taken=${damage_taken}`)
            if (!response.boss_status) {
                log('Report Boss Damage failed, retry...')
                healTime = 0
                inBoss = false
                return joinGame()
            }
            $audio[0].loop = false
            $audio[0].pause()
            $audio[0].currentTime = 0
            log('Report Boss Damage success.')
            let playerInfo
            if (typeof gAccountID !== 'undefined') {
                playerInfo = response.boss_status.boss_players.find(({ accountid }) => accountid === gAccountID)
            }
            const { boss_status: { boss_hp, boss_max_hp } } = response
            log(`Boss HP: ${boss_hp}/${boss_max_hp} ${(boss_hp / boss_max_hp * 100).toFixed(2)}%`)
            if (playerInfo) {
                log(`EXP:${parseInt(playerInfo.score_on_join) + playerInfo.xp_earned}`)
            }
            if (response.game_over) {
                log('Boss is over~')
                healTime = 0
                inBoss = false
                planetList = null
                bossOveredList.push({ pid: currentPlanetID, zp: currentZone.zone_position })
                return joinGame()
            } else if (response.waiting_for_players) {
                log('Waiting for players...')
                return bossFight()
            }
            return bossFight()
        } catch (e) {
            log('Report Boss Damage failed, retry...')
            healTime = 0
            inBoss = false
            return joinGame()
        }
    }

    function log() {
        const date = new Date()
        const time = `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]\t`
        console.log(time, ...arguments)
        $output.append($('<div>').text(`${time}\t ${arguments[0]}`))
        requestAnimationFrame(() => { $output[0].scrollTop = 10e10 })
    }
    async function start() {
        if (running) {
            return
        }
        errorTime = 0
        try {
            token = (await $.get('https://steamcommunity.com/saliengame/gettoken')).token
        } catch (e) {
            console.error(e)
            log('Get token failed, wait 2s...')
            gameTimer = setTimeout(start, 2000)
            return
        }
        running = true
        log('Script is running.')
        joinGame()
        return
    }

    async function stop(goBoss) {
        clearTimeout(gameTimer)
        if (!goBoss) {
            clearTimeout(planetTimer)
            planetList = null
            log('Script is ended.')
        } else {
            log('Stop and go to boss...')
        }
        running = false
        await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${currentGame}`)
        goBoss && start()
    }

    log(`Boss alert sound is ${bossSound ? 'on' : 'off'}.`)
    function sound() {
        bossSound = !bossSound;
        localStorage.setItem('dogeBossSound', bossSound ? '1' : '0')
        log(`Boss alert sound is ${bossSound ? 'on, playing preview' : 'off'}.`)
        if (bossSound) {
            $audio[0].play()
        } else {
            $audio[0].loop = false
            $audio[0].pause()
            $audio[0].currentTime = 0
        }

    }
    window.superDoge && window.superDoge.stop()
    window.superDoge = { start, stop, fire, endFire, sound }
    start()
}
)(jQuery, 1)