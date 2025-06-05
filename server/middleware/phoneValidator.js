import RESTAURANT from '../model/restaurant.js'
// import EMPLOYEE from '../models/User/employee.js'

const validatePhoneNumbers = async (phoneNumbers, excludeId = null, isEmployee = false) => {
    if (!phoneNumbers.length) return false; // No phone numbers to check

    let existInRestaurant = null;
    let existInEmployee = null;

    if (!isEmployee) {
        // If checking for a restaurant, exclude the current restaurant's ID when updating
        existInRestaurant = await RESTAURANT.findOne({
            ...(excludeId && { _id: { $ne: excludeId } }), 
            isDeleted: false,
            $or: [
                { phone: { $in: phoneNumbers } },
                { phone2: { $in: phoneNumbers } },
                { phone3: { $in: phoneNumbers } },
            ],
        });
    }

    // if (isEmployee) {
    //     // If checking for an employee, exclude the current employee's ID when updating
    //     existInEmployee = await EMPLOYEE.findOne({
    //         ...(excludeId && { _id: { $ne: excludeId } }), 
    //          b: false,
    //         $or: [
    //             { contactNo: { $in: phoneNumbers } },
    //             { contactNo2: { $in: phoneNumbers } },
    //             { contactNo3: { $in: phoneNumbers } },
    //         ],
    //     });
    // }

    return existInRestaurant || existInEmployee; // Returns true if a conflict exists
};

export default validatePhoneNumbers;
