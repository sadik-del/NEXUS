// ==============================
// AUTHENTICATION
// ==============================

function showForm(form) {

    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");

    const tabs = document.querySelectorAll(".auth-tab");

    if (form === "login") {

        loginForm.classList.add("active");
        registerForm.classList.remove("active");

        tabs[0].classList.add("active");
        tabs[1].classList.remove("active");

    } else {

        registerForm.classList.add("active");
        loginForm.classList.remove("active");

        tabs[1].classList.add("active");
        tabs[0].classList.remove("active");
    }
}


// ==============================
// REGISTER
// ==============================

document
    .getElementById("registerForm")
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const name =
            document.getElementById("registerName").value.trim();

        const username =
            document.getElementById("registerUsername").value.trim();

        const email =
            document.getElementById("registerEmail").value.trim();

        const password =
            document.getElementById("registerPassword").value;

        const message =
            document.getElementById("registerMessage");

        message.textContent = "Creating account...";

        try {

            const response = await fetch("/api/auth/register", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    username,
                    email,
                    password
                })

            });

            const data = await response.json();

            if (!response.ok) {

                message.textContent = data.message;

                return;
            }

            // Save authentication data
            localStorage.setItem("nexusToken", data.token);
            localStorage.setItem(
                "nexusUser",
                JSON.stringify(data.user)
            );

            message.textContent =
                "Account created successfully!";

            // Redirect
            setTimeout(() => {
                window.location.href = "/";
            }, 800);

        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to connect to server.";
        }

    });


// ==============================
// LOGIN
// ==============================

document
    .getElementById("loginForm")
    .addEventListener("submit", async (event) => {

        event.preventDefault();

        const email =
            document.getElementById("loginEmail").value.trim();

        const password =
            document.getElementById("loginPassword").value;

        const message =
            document.getElementById("loginMessage");

        message.textContent = "Logging in...";

        try {

            const response = await fetch("/api/auth/login", {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })

            });

            const data = await response.json();

            if (!response.ok) {

                message.textContent = data.message;

                return;
            }

            // Save authentication data
            localStorage.setItem("nexusToken", data.token);

            localStorage.setItem(
                "nexusUser",
                JSON.stringify(data.user)
            );

            message.textContent =
                "Login successful!";

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = "/";
            }, 500);

        } catch (error) {

            console.error(error);

            message.textContent =
                "Unable to connect to server.";
        }

    });