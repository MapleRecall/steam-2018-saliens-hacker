// ==UserScript==
// @name            Steam 2018 summer game hacker
// @version         0.1
// @author           MapleRecall
// @downloadURL     https://coding.net/u/maplerecall/p/steam-2018-summer-game-hack/git/raw/master/index.js
//
// @license         MIT License
// @copyright       Copyright (C) 2018, by MapleRecall 
//
// @include         https://steamcommunity.com/saliengame
// @include         https://steamcommunity.com/saliengame/
// @include         https://steamcommunity.com/saliengame/play
// @include         https://steamcommunity.com/saliengame/play/
//
// @version         1.0.0
// @updateURL		https://coding.net/u/maplerecall/p/steam-2018-summer-game-hack/git/raw/master/index.js
//
// @run-at			document-start|document-end
// @grant        none
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

    async function joinGame() {
        clearTimeout(gameTimer)
        log(`==============================================================`)
        errorTime = 0
        try {
            log(`Fetch info...`)
            var { response } = await $.post(`${gameUrlPrefix}/GetPlayerInfo/v0001/`, `access_token=${token}`)
            const { active_planet, level, score: _score, next_level_score, active_zone_game, clan_info } = response
            if (active_zone_game) {
                log('Alreay in a game, try to leave...')
                await $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${active_zone_game}`)
            }
            if (forSTCN && (!clan_info || clan_info.accountid !== stcnId)) {
                await $.post(`${gameUrlPrefix}/RepresentClan/v0001/`, `clanid=103582791429777370&access_token=${token}`)
            }

            let planet
            if (!active_planet) {
                log(`Joining planet...`)
                var { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanets/v0001/?active_only=1&language=schinese`)
                planet = planets.sort((a, b) => a.state.capture_progress - b.state.capture_progress)[0]
                await $.post(`${gameUrlPrefix}/JoinPlanet/v0001/`, `id=${planet.id}&access_token=${token}`)
            }
            var { response: { planets } } = await $.get(`${gameUrlPrefix}/GetPlanet/v0001/?id=${active_planet}&language=schinese`)
            planet = planets[0]
            log(`Planet: ${planet.state.name}  Level: ${level}  Exp: ${_score}/${next_level_score}  Team: ${clan_info ? clan_info.name : 'None'}`)
            let zones = planet.zones.filter(({ captured }) => !captured)
            let targetZone
            if (forSTCN && clan_info && clan_info.accountid === stcnId) {
                targetZone = findTarget(zones, planet)
            } else {
                zones = zones.reverse()
                targetZone = zones.find(({ difficulty }) => difficulty === 3) || zones.find(({ difficulty }) => difficulty === 2) || zones[0]
            }

            const { zone_position, difficulty, capture_progress: progress } = targetZone
            score = difficulty === 1 ? 595 : difficulty === 2 ? 1190 : 2380
            log(`Joining zone...`)
            var { response } = await $.post(`${gameUrlPrefix}/JoinZone/v0001/`, `zone_position=${zone_position}&access_token=${token}`)
            if (response.zone_info) {
                log(`Join zone ${zone_position}(${zone_position % 12 + 1 | 0},${zone_position / 12 + 1 | 0}) success.`)
                log(`Progress: ${(progress * 100).toFixed(2)}%, wait 110s to send score ${score}...`)
                currentGame = response.gameid
                gameTimer = setTimeout(sendScore, 110000)
            } else {
                throw 'Service reject.'
            }
        } catch (e) {
            console.error(e)
            log(`Join zone fail, wait 4s...`)
            gameTimer = setTimeout(joinGame, 4000)
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
                gameTimer = setTimeout(joinGame, 100)
                errorTime = 0
            }
        }
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

    function stop() {
        clearTimeout(gameTimer)
        running = false
        log('Script is ended.')
        $.post(`https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/`, `access_token=${token}&gameid=${currentGame}`)
    }

    function findTarget(_zones, planet) {
        if (planet.state.capture_progress < 0.15) {
            return _zones.filter(({ difficulty }) => difficulty === 3)[0] || _zones.filter(({ difficulty }) => difficulty === 2)[0] || _zones[0]
        }
        let zones = _zones.sort(({ capture_progress: a }, { capture_progress: b }) => b - a)
        for (let i = 0; i < 3; i++) {
            target = zones.filter(({ capture_progress, top_clans }) => (capture_progress < 1 / (i + 1)) && top_clans[i] && top_clans[i].accountid === stcnId)[0]
            if (target) {
                return target
            }
        }
        return zones.pop()
    }

    function log() {
        const date = new Date()
        const time = `[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}]\t`
        console.log(time, ...arguments)
    }
    window.superDoge && window.superDoge.stop()
    window.superDoge = { start, stop }
    start()
}
)(jQuery, 1)
