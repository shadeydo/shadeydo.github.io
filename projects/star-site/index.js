
var colorPicker = new iro.ColorPicker('#picker', {
    handleRadius: 10,
    width: 200,

    // Stacks components horizontally (left-to-right) and makes sliders vertical
    layoutDirection: 'horizontal',

    // Define the component arrangement (Wheel on the left, Slider on the right)
    layout: [
        {
            component: iro.ui.Wheel,
        },
        {
            component: iro.ui.Slider,
            options: {
                sliderType: 'value' // Can also be 'saturation', 'hue', 'alpha', etc.
            }
        }
    ]
});


var unlocked = false;

const results = document.getElementById("results");


const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function yearsAgo(dateString) {
    return (Date.parse(dateString) - Date.now()) / MS_PER_YEAR;
}

const formatter = new Intl.RelativeTimeFormat('en-US', {
    numeric: 'always',
    style: 'long'
});

colorPicker.on('color:change', function (color) {
    const colorObj = new Color(color.hexString)
    document.documentElement.style.setProperty('--picked-color', color.hexString);
    go(color.hexString);
});

async function go(colora) {

    const bgResponse = await fetch("bgs.json");
    const bgData = await bgResponse.json();

    const color = new Color(colora);

    if (unlocked) {

        const response = await fetch("data.json");
        const data = await response.json();

        for (const img of data) {
            const avgDiff = color.deltaE(new Color(img["Avg"]), { method: "2000" });
            const dominantDiff = color.deltaE(new Color(img["Dominant"]), { method: "2000" });

            img["AvgDiff"] = avgDiff;
            img["DominantDiff"] = dominantDiff;
        }
        data.sort(diffCompare);


        // results.innerHTML = "";

        const clone = results.cloneNode(true);

        clone.style.position = "absolute";
        clone.style.top = results.getBoundingClientRect().top - 64 + "px";
        clone.style.left = results.getBoundingClientRect().left + "px";
        clone.style.pointerEvents = "none";
        clone.style.zIndex = 1;

        for (const element of clone.children) {
            element.style.animation = "none";
            if (element.getAttribute("persistent") != "true") {
                element.style.visibility = "hidden";
                // element.style.opacity = 0.5;
                element.style.pointerEvents = "none";
            } else {
                element.style.pointerEvents = "auto";
            }
        }

        document.documentElement.appendChild(clone);




        results.innerHTML = "";


        for (let i = 0; i < 5; i++) {
            const imgData = data[i]

            const imgElement = document.createElement("div");
            imgElement.classList.add("color-image");

            const img = document.createElement("img");
            img.src = imgData["Path"];

            const date = document.createElement("p");
            date.classList.add("date");
            const years = Math.round(yearsAgo(imgData.DateTime) * 100) / 100;
            date.innerText = formatter.format(years, "year");

            var primaryColor;

            if (imgData["AvgDiff"] <= imgData["DominantDiff"]) {
                primaryColor = imgData.Avg;
            } else {
                primaryColor = imgData.Dominant
            }

            img.style.borderColor = primaryColor;
            date.style.backgroundColor = primaryColor;
            date.style.color = `contrast-color(${primaryColor})`

            img.style.borderWidth = `${10 - (years * 3)}px`;
            imgElement.style.animationDuration = `${.2 + (-years / 5)}s`;
            imgElement.setAttribute("persistent", "false");

            img.setAttribute("draggable", false);





            imgElement.appendChild(img);
            imgElement.appendChild(date);
            results.appendChild(imgElement);
        }
    }


    for (const img of bgData) {
        const avgDiff = color.deltaE(new Color(img["Avg"]), { method: "2000" });
        const dominantDiff = color.deltaE(new Color(img["Dominant"]), { method: "2000" });

        img["AvgDiff"] = avgDiff;
        img["DominantDiff"] = 100000;
    }

    bgData.sort(diffCompare);

    // console.log(bgData[0].Path);
    document.body.style.backgroundImage = `url(${bgData[0].Path})`;


}

function diffCompare(imgA, imgB) {
    const lowestA = Math.min(imgA["AvgDiff"], imgA["DominantDiff"]);
    const lowestB = Math.min(imgB["AvgDiff"], imgB["DominantDiff"]);
    return Math.sign(lowestA - lowestB)

    // return Math.sign(imgA.AvgDiff-imgB.AvgDiff)
}


function unlock() {
    const input = document.getElementById("password");

    console.log("testing")
    if (input.value == "froggy") {
        document.getElementById("password-slot").style.display = "none";
        unlocked = true;
        document.getElementById("tip").style.visibility = "visible";
        if (colorPicker.color.hexString != "#ffffff") {
            go(colorPicker.color.hexString);
        } else {
            document.getElementById("results").innerHTML = "<p>GO!</p>";
        }
    } else {
        input.classList.remove("shivering");
        void input.offsetWidth;
        input.classList.add("shivering");

    }
};

console.log(window.innerWidth)
if (window.innerWidth > 600) {
    interact('.color-image')
        .draggable({
            // enable inertial throwing
            inertia: true,
            // keep the element within the area of it's parent
            modifiers: [
                interact.modifiers.restrictRect({
                    restriction: 'html',
                    endOnly: true
                })
            ],
            // enable autoScroll
            autoScroll: true,

            listeners: {
                // call this function on every dragmove event
                move: dragMoveListener,

                // call this function on every dragend event
                end(event) {
                    event.target.setAttribute("persistent", "true")
                    // const img = event.target;
                    // const clone = img.cloneNode(true);
                    // clone.style.visibility = "hidden";
                    // clone.style.pointerEvents = "none";

                    // img.before(clone)

                    // img.style.width = img.offsetWidth+px;



                }
            }
        })

}

function dragMoveListener(event) {
    var target = event.target
    // keep the dragged position in the data-x/data-y attributes
    var x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx
    var y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy

    // translate the element
    target.style.transform = 'translate(' + x + 'px, ' + y + 'px)'

    // update the posiion attributes
    target.setAttribute('data-x', x)
    target.setAttribute('data-y', y)
}
