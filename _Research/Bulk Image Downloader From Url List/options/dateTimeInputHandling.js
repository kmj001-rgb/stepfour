    datetimeInputs.forEach(input => {
        input.addEventListener('change', function () {
            const selectedDateTime = new Date(this.value);
            const today = new Date();

            if (isNaN(selectedDateTime) || selectedDateTime < today) {
                alert('Please select a valid date and time in the future.');
                this.value = getMinDateTime(); // Reset to minimum datetime
            }
        });
    });

    function getMinDateTime() {
        const currentDateTime = new Date();
        const minDateTime = new Date(currentDateTime.getTime() + 2 * 60 * 1000); // Current time + 2 minutes
        return minDateTime.toISOString().slice(0, 16); // Format datetime as "YYYY-MM-DDTHH:MM"
    }
