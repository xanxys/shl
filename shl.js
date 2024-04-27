// [false, true] -> "01"
const patternToString = pat => pat.map(v => v ? '1' : '0').join('');

// "01" -> [false, true]
const patternFromString = s => [...s].map(v => v === '1');

const ecaView = new ECAView();

const app = Vue.createApp({
    data() {
        return {
            probText: "1e-3",
            prob: 1e-3,
            probValid: true,
        };
    },

    watch: {
        probText(newValue) {
            const p = parseFloat(newValue);
            this.probValid = (!isNaN(p) && 0 <= p && p <= 1);
            if (this.probValid) {
                this.prob = p;
            }
        },

        prob(newValue) {
            ecaView.updateSTB(new STBlocks(new STAbsolute(110, [true], [false], [false])));
        },
    },

    mounted() {
        ecaView.updateSTB(new STBlocks(new STAbsolute(110, [true], [false], [false])));
    }
});

app.mount("#app");
