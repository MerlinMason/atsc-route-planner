// Unscramble the egg

const omelette = '1963ad119e564f6ea53c9e4b7e53efb4'.split('').reverse().join('');

function makeEgg(omelette) {
    return omelette.split('').reverse().join('');
}

const egg = makeEgg(omelette);

export default egg;